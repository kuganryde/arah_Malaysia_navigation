#!/usr/bin/env python3
"""Make the official YOLOX-nano ONNX loadable by onnxruntime-web's WebGL backend. Three mechanical rewrites:

1. The Focus stem (8 strided Slice nodes + Concat) becomes ONE Conv with a one-hot 2x2 kernel and stride 2.
   It is the same arithmetic (space-to-depth in Focus order); WebGL rejects Slice steps other than 1.
2. Each 2x nearest Resize (the FPN upsample) becomes a depthwise ConvTranspose with a 2x2 all-ones kernel and
   stride 2: identical output; WebGL's packed Resize kernel lacks the 'nearest' mode.
3. int64 constants (Reshape shapes etc.) become int32; WebGL rejects int64.

Usage: python3 scripts/ar/webgl_compat.py yolox_nano.onnx out.onnx
Weights are untouched. Provenance and hashes are in assets/ar/models/MODEL.md; `npm run check` verifies the
shipped file's SHA-256, and test/ar-model.test.mjs-style checks live in the browser smoke test.
"""
import sys
import numpy as np
import onnx
from onnx import numpy_helper, helper, TensorProto

src, dst = sys.argv[1], sys.argv[2]
m = onnx.load(src)
g = m.graph
nodes = list(g.node)

# --- 1. Focus stem -> Conv -------------------------------------------------------------------
first_input = g.input[0].name
slices = [n for n in nodes[:8] if n.op_type == 'Slice']
concat = nodes[8]
assert len(slices) == 8 and concat.op_type == 'Concat' and list(concat.input) == [nodes[1].output[0], nodes[5].output[0], nodes[3].output[0], nodes[7].output[0]], \
    'unexpected stem layout: this script only knows the official yolox_nano.onnx'
C = 3
# Output block order of YOLOX Focus: (row0,col0), (row1,col0), (row0,col1), (row1,col1), each carrying all C channels.
w = np.zeros((4 * C, C, 2, 2), np.float32)
for blk, (kh, kw) in enumerate([(0, 0), (1, 0), (0, 1), (1, 1)]):
    for c in range(C):
        w[blk * C + c, c, kh, kw] = 1.0
g.initializer.append(numpy_helper.from_array(w, 'focus_w'))
conv = helper.make_node('Conv', [first_input, 'focus_w'], [concat.output[0]], name='focus_conv', kernel_shape=[2, 2], strides=[2, 2], pads=[0, 0, 0, 0])
del g.node[:]
g.node.extend([conv] + nodes[9:])

# --- 2. nearest 2x Resize -> depthwise ConvTranspose ----------------------------------------
inferred = onnx.shape_inference.infer_shapes(m)
chan = {v.name: v.type.tensor_type.shape.dim[1].dim_value for v in list(inferred.graph.value_info) + list(inferred.graph.input)}
init_by_name = {i.name: i for i in g.initializer}
new_nodes = []
for n in g.node:
    if n.op_type != 'Resize':
        new_nodes.append(n)
        continue
    mode = next(a.s for a in n.attribute if a.name == 'mode')
    scales = numpy_helper.to_array(init_by_name[n.input[2]])
    assert mode == b'nearest' and list(scales) == [1, 1, 2, 2], 'only 2x nearest upsampling is handled'
    ch = chan[n.input[0]]
    assert ch > 0, 'unknown channel count'
    wname = f'{n.name or n.output[0]}_up_w'
    g.initializer.append(numpy_helper.from_array(np.ones((ch, 1, 2, 2), np.float32), wname))
    new_nodes.append(helper.make_node('ConvTranspose', [n.input[0], wname], list(n.output), name=f'{n.name or n.output[0]}_up',
                                      kernel_shape=[2, 2], strides=[2, 2], group=ch, pads=[0, 0, 0, 0]))
del g.node[:]
g.node.extend(new_nodes)

# Drop initializers nothing uses any more (the old Slice parameters).
used = {i for n in g.node for i in n.input}
keep = [i for i in g.initializer if i.name in used]
del g.initializer[:]
g.initializer.extend(keep)

# --- 3. int64 constants -> int32 -------------------------------------------------------------
n64 = 0
def conv32(t):
    global n64
    if t.data_type == TensorProto.INT64:
        a = numpy_helper.to_array(t)
        assert np.all(np.abs(a) < 2**31 - 1), 'value out of int32 range'
        t.CopyFrom(numpy_helper.from_array(a.astype(np.int32), t.name))
        n64 += 1
for init in g.initializer:
    conv32(init)
for node in g.node:
    if node.op_type == 'Constant':
        for at in node.attribute:
            if at.name == 'value':
                conv32(at.t)
onnx.checker.check_model(m)
onnx.save(m, dst)
print(f'focus -> conv; resize -> convtranspose; {n64} int64 tensors -> int32; {len(g.node)} nodes; wrote {dst}')
