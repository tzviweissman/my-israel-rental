import cv2,numpy as np
a=cv2.imread('b-last.png'); p=cv2.imread('pano.png')[:, 380:380+2560]
g=lambda x:cv2.cvtColor(x,cv2.COLOR_BGR2GRAY)
s=cv2.SIFT_create(4000); ka,da=s.detectAndCompute(g(a),None); kb,db=s.detectAndCompute(g(p),None)
m=[x for x,y in cv2.BFMatcher().knnMatch(da,db,k=2) if x.distance<.72*y.distance]
A,inl=cv2.estimateAffinePartial2D(np.float32([kb[x.trainIdx].pt for x in m]),np.float32([ka[x.queryIdx].pt for x in m]))
print(len(m),int(inl.sum())); print(A.round(3)); print('scale',np.hypot(A[0,0],A[1,0]).round(3))
c=np.hstack([cv2.resize(a,(960,540)),cv2.resize(p,(960,540))]); cv2.imwrite('align.jpg',c)
