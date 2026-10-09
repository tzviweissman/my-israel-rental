import cv2, glob, sys, numpy as np
tag, w, cols = sys.argv[1], int(sys.argv[2]), int(sys.argv[3])
fs = sorted(glob.glob(f'q-{tag}-*.png')); ims = []
for f in fs:
    im = cv2.imread(f); im = cv2.resize(im, (w, int(im.shape[0] * w / im.shape[1])))
    cv2.putText(im, f[-7:-4], (6, 22), 0, .7, (0, 0, 255), 2); ims.append(im)
while len(ims) % cols: ims.append(np.full_like(ims[0], 255))
cv2.imwrite(f'sheet-{tag}.png', cv2.vconcat([cv2.hconcat(ims[i:i + cols]) for i in range(0, len(ims), cols)]))
