import React from 'react';
import { ChevronRight } from 'lucide-react';

interface SCO {
  identifier: string;
  href: string;
}

interface ScormViewerProps {
  courseTitle: string;
  scos: SCO[];
}

const ScormViewer: React.FC<ScormViewerProps> = ({ courseTitle, scos }) => {
  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-2xl font-bold text-gray-800 mb-4">{courseTitle}</h2>
      
      <div className="space-y-2">
        {scos.map((sco) => (
          <div 
            key={sco.identifier}
            className="flex items-center p-3 hover:bg-gray-50 rounded-md cursor-pointer border border-gray-200"
          >
            <ChevronRight className="h-5 w-5 text-blue-500 mr-2" />
            <span className="text-gray-700">{sco.href}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ScormViewer;