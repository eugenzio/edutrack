import { type ReactNode } from 'react';

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      {/* Menu Bar */}
      <div className="bg-gray-200 border-b border-gray-400">
        <div className="flex items-center px-2 py-1 text-xs">
          <button className="px-2 py-0.5 hover:bg-gray-300">File</button>
          <button className="px-2 py-0.5 hover:bg-gray-300">Edit</button>
          <button className="px-2 py-0.5 hover:bg-gray-300">View</button>
          <button className="px-2 py-0.5 hover:bg-gray-300">Analysis</button>
          <button className="px-2 py-0.5 hover:bg-gray-300">Help</button>
          <div className="flex-1"></div>
          <span className="text-gray-600 font-semibold">EduTrack v3.0</span>
        </div>
      </div>

      {/* Toolbar */}
      <div className="bg-white border-b border-gray-300">
        <div className="flex items-center px-2 py-1 gap-1 text-xs">
          <button className="px-2 py-1 border border-gray-400 bg-gray-100 hover:bg-gray-200">
            Open
          </button>
          <button className="px-2 py-1 border border-gray-400 bg-gray-100 hover:bg-gray-200">
            Save
          </button>
          <button className="px-2 py-1 border border-gray-400 bg-gray-100 hover:bg-gray-200">
            Export
          </button>
          <div className="w-px h-4 bg-gray-400 mx-1"></div>
          <span className="text-gray-500 text-xs">
            MP4, WebM, OGG | Max: 500MB
          </span>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>

      {/* Status Bar */}
      <div className="bg-gray-200 border-t border-gray-400 px-2 py-0.5 text-xs text-gray-600">
        <span>Ready</span>
      </div>
    </div>
  );
}
