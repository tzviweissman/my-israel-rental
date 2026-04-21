import React, { useRef, useState, useEffect } from 'react';
import { X, Upload, Move, Maximize2 } from 'lucide-react';
import { Rnd } from 'react-rnd';
import { API } from '../../App';

const ContractSignModal = ({ 
  isOpen, 
  onClose, 
  bookingId, 
  contractPreviewUrl,
  onSignSuccess 
}) => {
  const [signatureData, setSignatureData] = useState('');
  const [signatureMethod, setSignatureMethod] = useState('draw');
  const [showContractPreview, setShowContractPreview] = useState(false);
  const [signaturePosition, setSignaturePosition] = useState({ x: 50, y: 100 });
  const [signatureSize, setSignatureSize] = useState({ width: 200, height: 100 });
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const previewScrollRef = useRef(null);
  const prevScrollTopRef = useRef(0);

  // When the preview scrolls, shift the signature's Y position by the same
  // delta so it visually stays in the viewport. The stored position still
  // represents where the signature will be stamped on the contract.
  useEffect(() => {
    if (!showContractPreview) return;
    const el = previewScrollRef.current;
    if (!el) return;
    prevScrollTopRef.current = el.scrollTop;
    const onScroll = () => {
      const newTop = el.scrollTop;
      const delta = newTop - prevScrollTopRef.current;
      prevScrollTopRef.current = newTop;
      if (delta !== 0) {
        setSignaturePosition(prev => ({ x: prev.x, y: Math.max(0, prev.y + delta) }));
      }
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [showContractPreview]);

  // Convert a pointer event (mouse or touch) to canvas-buffer coordinates.
  // The canvas has a fixed internal resolution (e.g. 600x200) but is stretched
  // via CSS to fill the container — so we must scale by rect.width/height.
  const getCanvasPoint = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    // Support touch events too
    const clientX = e.clientX ?? e.touches?.[0]?.clientX ?? e.changedTouches?.[0]?.clientX ?? 0;
    const clientY = e.clientY ?? e.touches?.[0]?.clientY ?? e.changedTouches?.[0]?.clientY ?? 0;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  };

  const startDrawing = (e) => {
    if (!canvasRef.current) return;
    e.preventDefault?.();
    const { x, y } = getCanvasPoint(e);
    const ctx = canvasRef.current.getContext('2d');
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
  };

  const draw = (e) => {
    if (!isDrawing || !canvasRef.current) return;
    e.preventDefault?.();
    const { x, y } = getCanvasPoint(e);
    const ctx = canvasRef.current.getContext('2d');
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    if (canvasRef.current) {
      setSignatureData(canvasRef.current.toDataURL());
    }
  };

  const clearSignature = () => {
    if (canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    setSignatureData('');
  };

  const handleSignatureUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSignatureData(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleClose = () => {
    setShowContractPreview(false);
    setSignatureData('');
    setSignatureMethod('draw');
    setSignaturePosition({ x: 50, y: 100 });
    setSignatureSize({ width: 200, height: 100 });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={handleClose}>
      <div className="bg-white rounded-2xl p-6 max-w-6xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-2xl font-bold text-[#1E6A6A]">Sign Rental Contract</h3>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {!showContractPreview ? (
          <>
            <p className="text-gray-600 mb-6">
              Step 1: Create your signature. You can either draw it or upload an image.
            </p>

            {/* Signature Method Tabs */}
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setSignatureMethod('draw')}
                className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  signatureMethod === 'draw'
                    ? 'bg-[#1E6A6A] text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Draw Signature
              </button>
              <button
                onClick={() => setSignatureMethod('upload')}
                className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  signatureMethod === 'upload'
                    ? 'bg-[#1E6A6A] text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Upload Signature
              </button>
            </div>

            {/* Draw Signature */}
            {signatureMethod === 'draw' && (
              <div className="mb-6">
                <canvas
                  ref={canvasRef}
                  width={600}
                  height={200}
                  onMouseDown={startDrawing}
                  onMouseMove={draw}
                  onMouseUp={stopDrawing}
                  onMouseLeave={stopDrawing}
                  onTouchStart={startDrawing}
                  onTouchMove={draw}
                  onTouchEnd={stopDrawing}
                  onTouchCancel={stopDrawing}
                  className="w-full border-2 border-gray-300 rounded-lg cursor-crosshair bg-white"
                  style={{ touchAction: 'none' }}
                />
                <button
                  onClick={clearSignature}
                  className="mt-2 px-4 py-2 rounded-lg text-sm font-medium border border-gray-300 hover:bg-gray-50 transition-colors"
                >
                  Clear Signature
                </button>
              </div>
            )}

            {/* Upload Signature */}
            {signatureMethod === 'upload' && (
              <div className="mb-6">
                <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-[#1E6A6A] transition-colors">
                  {signatureData ? (
                    <img src={signatureData} alt="Signature" className="max-h-40 object-contain" />
                  ) : (
                    <div className="text-center">
                      <Upload size={40} className="mx-auto mb-2 text-gray-400" />
                      <p className="text-sm text-gray-600">Click to upload signature image</p>
                    </div>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleSignatureUpload}
                    className="hidden"
                  />
                </label>
              </div>
            )}

            {/* Preview */}
            {signatureData && (
              <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                <p className="text-sm font-medium text-gray-700 mb-2">Signature Preview:</p>
                <img src={signatureData} alt="Signature preview" className="max-h-32 border border-gray-300 rounded bg-white" />
              </div>
            )}

            {/* Next Button */}
            <div className="flex gap-3">
              {contractPreviewUrl && signatureData ? (
                <button
                  onClick={() => setShowContractPreview(true)}
                  className="flex-1 px-4 py-3 rounded-lg text-sm font-medium bg-[#1E6A6A] text-white hover:bg-[#1E6A6A]/90 transition-colors"
                >
                  Next: Position Signature
                </button>
              ) : (
                <button
                  onClick={onSignSuccess}
                  disabled={!signatureData}
                  className="flex-1 px-4 py-3 rounded-lg text-sm font-medium bg-[#D4AF37] text-white hover:bg-[#D4AF37]/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Sign Contract
                </button>
              )}
              <button
                onClick={handleClose}
                className="px-4 py-3 rounded-lg text-sm font-medium border border-gray-300 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="text-gray-600 mb-4">
              Step 2: Drag and resize your signature to position it on the contract.
            </p>

            {/* Contract Preview with Draggable Signature */}
            <div ref={previewScrollRef} className="mb-6 relative border-2 border-gray-300 rounded-lg overflow-auto bg-gray-100" style={{ maxHeight: '60vh' }}>
              <div className="relative inline-block">
                {/* Contract Document */}
                {contractPreviewUrl.toLowerCase().endsWith('.pdf') ? (
                  <iframe
                    src={contractPreviewUrl}
                    className="w-full h-auto"
                    style={{ minHeight: '800px', minWidth: '600px' }}
                    title="Contract Preview"
                  />
                ) : (
                  <img
                    src={contractPreviewUrl}
                    alt="Contract"
                    className="w-full h-auto"
                    style={{ minWidth: '600px' }}
                  />
                )}

                {/* Draggable Signature Overlay */}
                <Rnd
                  size={{ width: signatureSize.width, height: signatureSize.height }}
                  position={{ x: signaturePosition.x, y: signaturePosition.y }}
                  onDragStop={(e, d) => {
                    setSignaturePosition({ x: d.x, y: d.y });
                  }}
                  onResizeStop={(e, direction, ref, delta, position) => {
                    setSignatureSize({
                      width: ref.offsetWidth,
                      height: ref.offsetHeight,
                    });
                    setSignaturePosition(position);
                  }}
                  bounds="parent"
                  className="border-2 border-dashed border-blue-500 bg-white/80 flex items-center justify-center cursor-move"
                  style={{ zIndex: 10 }}
                >
                  <img
                    src={signatureData}
                    alt="Signature"
                    className="w-full h-full object-contain pointer-events-none"
                  />
                  <div className="absolute top-1 right-1 bg-blue-500 text-white text-xs px-2 py-1 rounded">
                    <Move size={12} className="inline" /> Drag & <Maximize2 size={12} className="inline" /> Resize
                  </div>
                </Rnd>
              </div>
            </div>

            {/* Position Info */}
            <div className="mb-4 p-3 bg-blue-50 rounded-lg text-sm text-gray-700">
              <p><strong>Tip:</strong> Drag the signature to move it. Drag the edges or corners to resize it.</p>
              <p className="mt-1">Position: X: {Math.round(signaturePosition.x)}px, Y: {Math.round(signaturePosition.y)}px | Size: {Math.round(signatureSize.width)} × {Math.round(signatureSize.height)}px</p>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                onClick={() => setShowContractPreview(false)}
                className="px-4 py-3 rounded-lg text-sm font-medium border border-gray-300 hover:bg-gray-50 transition-colors"
              >
                Back
              </button>
              <button
                onClick={() => onSignSuccess(signatureData, signaturePosition, signatureSize)}
                className="flex-1 px-4 py-3 rounded-lg text-sm font-medium bg-[#D4AF37] text-white hover:bg-[#D4AF37]/90 transition-colors"
              >
                Sign Contract
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ContractSignModal;
