import React, { useState } from 'react';
import { toast } from 'react-hot-toast';

export interface Blocker {
  id: string;
  type: 'Risk' | 'Issue' | 'Dependency' | 'Blocker';
  description: string;
  resolutionDate: string;
}

interface BlockerSectionProps {
  blockers: Blocker[];
  onBlockersChange: (blockers: Blocker[]) => void;
}

export default function BlockerSection({ blockers, onBlockersChange }: BlockerSectionProps) {
  const [showBlockerForm, setShowBlockerForm] = useState(false);
  const [currentBlocker, setCurrentBlocker] = useState<Partial<Blocker>>({
    type: 'Issue',
    description: '',
    resolutionDate: ''
  });

  const handleAddBlocker = () => {
    if (!currentBlocker.description || !currentBlocker.resolutionDate) {
      toast.error('Please fill in all blocker fields');
      return;
    }

    const newBlocker: Blocker = {
      id: Date.now().toString(),
      type: currentBlocker.type as 'Risk' | 'Issue' | 'Dependency' | 'Blocker',
      description: currentBlocker.description,
      resolutionDate: currentBlocker.resolutionDate
    };

    onBlockersChange([...blockers, newBlocker]);
    
    // Reset form
    setCurrentBlocker({
      type: 'Issue',
      description: '',
      resolutionDate: ''
    });
    
    setShowBlockerForm(false);
  };

  const handleRemoveBlocker = (id: string) => {
    onBlockersChange(blockers.filter(blocker => blocker.id !== id));
  };

  const handleBlockerChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setCurrentBlocker(prev => ({
      ...prev,
      [name]: value
    }));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-gray-200">Blockers / Risks / Dependencies</h3>
        <button
          onClick={() => setShowBlockerForm(!showBlockerForm)}
          className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-md text-sm transition-colors duration-300 flex items-center"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
          </svg>
          Add Blocker
        </button>
      </div>

      {showBlockerForm && (
        <div className="bg-[#262d40] p-4 rounded-lg space-y-4 animate-fadeIn">
          <div>
            <label htmlFor="blocker-type" className="block text-sm font-medium text-gray-300 mb-1">
              Type
            </label>
            <select
              id="blocker-type"
              name="type"
              value={currentBlocker.type}
              onChange={handleBlockerChange}
              className="w-full bg-[#1e2538] border border-gray-600 rounded-md px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="Issue">Issue</option>
              <option value="Risk">Risk</option>
              <option value="Dependency">Dependency</option>
              <option value="Blocker">Blocker</option>
            </select>
          </div>

          <div>
            <label htmlFor="blocker-description" className="block text-sm font-medium text-gray-300 mb-1">
              Description
            </label>
            <textarea
              id="blocker-description"
              name="description"
              value={currentBlocker.description}
              onChange={handleBlockerChange}
              rows={3}
              className="w-full bg-[#1e2538] border border-gray-600 rounded-md px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              placeholder="Describe the blocker, risk, or dependency..."
            />
          </div>

          <div>
            <label htmlFor="blocker-resolution" className="block text-sm font-medium text-gray-300 mb-1">
              Expected Resolution Date
            </label>
            <input
              type="date"
              id="blocker-resolution"
              name="resolutionDate"
              value={currentBlocker.resolutionDate}
              onChange={handleBlockerChange}
              className="w-full bg-[#1e2538] border border-gray-600 rounded-md px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          <div className="flex justify-end space-x-2">
            <button
              onClick={() => setShowBlockerForm(false)}
              className="px-4 py-2 text-sm text-gray-300 hover:text-white transition-colors duration-200"
            >
              Cancel
            </button>
            <button
              onClick={handleAddBlocker}
              className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-md text-sm transition-colors duration-300"
            >
              Add Blocker
            </button>
          </div>
        </div>
      )}

      {blockers.length > 0 && (
        <div className="space-y-3">
          {blockers.map((blocker) => (
            <div key={blocker.id} className="bg-[#262d40] p-4 rounded-lg animate-fadeIn">
              <div className="flex items-center justify-between mb-2">
                <span className={`inline-block px-2 py-1 text-xs rounded-full ${
                  blocker.type === 'Risk' ? 'bg-yellow-500/20 text-yellow-400' :
                  blocker.type === 'Issue' ? 'bg-red-500/20 text-red-400' :
                  blocker.type === 'Dependency' ? 'bg-blue-500/20 text-blue-400' :
                  'bg-orange-500/20 text-orange-400'
                }`}>
                  {blocker.type}
                </span>
                <button
                  onClick={() => handleRemoveBlocker(blocker.id)}
                  className="text-gray-400 hover:text-red-400 transition-colors duration-200"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
              <p className="text-white text-sm mb-2">{blocker.description}</p>
              <p className="text-gray-400 text-xs">
                Expected Resolution: {new Date(blocker.resolutionDate).toLocaleDateString()}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
} 