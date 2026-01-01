import { useRef } from 'react';
import { useVideoLoader } from '../../hooks/useVideoLoader';

export function DropZone() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { handleFileSelect, handleFileDrop, handleDragOver, error } = useVideoLoader();

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFileSelect(e.target.files);
  };

  return (
    <div className="border border-gray-400 bg-white p-2">
      <div
        onClick={handleClick}
        onDrop={handleFileDrop}
        onDragOver={handleDragOver}
        className="border-2 border-dashed border-gray-400 bg-gray-50 p-12 text-center cursor-pointer hover:border-gray-600 hover:bg-gray-100"
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="video/mp4,video/webm,video/ogg"
          onChange={handleInputChange}
          className="hidden"
        />

        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-700">
            Drop video file here or click to browse
          </p>
          <p className="text-xs text-gray-500">
            Supported: MP4, WebM, OGG | Max size: 500MB
          </p>
        </div>

        {error && (
          <div className="mt-3 p-2 bg-red-50 border border-red-600 text-xs text-red-800">
            Error: {error}
          </div>
        )}
      </div>
    </div>
  );
}
