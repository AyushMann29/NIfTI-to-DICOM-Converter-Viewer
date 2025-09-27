// components/SegmentationSidebar.tsx

interface SegmentationClass {
  label: string;
  value: number;
}

interface SidebarProps {
  classes: SegmentationClass[];
  visibility: { [key: number]: boolean };
  onToggle: (value: number) => void;
}

export default function SegmentationSidebar({ classes, visibility, onToggle }: SidebarProps) {
  // Generate a distinct color for each class
  const getColor = (value: number) => {
    const r = (value * 50) % 255;
    const g = (value * 90) % 255;
    const b = (value * 120) % 255;
    return `rgb(${r}, ${g}, ${b})`;
  };

  return (
    <aside className="w-64 bg-gray-900 p-4 rounded-lg shadow-lg">
      <h2 className="text-lg font-bold text-white mb-4">Segmentation Layers</h2>
      <div className="space-y-3">
        {classes.map((cls) => (
          <div key={cls.value} className="flex items-center justify-between bg-gray-800 p-2 rounded-md">
            <div className="flex items-center">
              <span
                className="w-3 h-3 rounded-full mr-3"
                style={{ backgroundColor: getColor(cls.value) }}
              ></span>
              <span className="text-sm text-gray-300">{cls.label}</span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={!!visibility[cls.value]}
                onChange={() => onToggle(cls.value)}
              />
              <div className="w-11 h-6 bg-gray-700 rounded-full peer peer-focus:ring-2 peer-focus:ring-blue-500 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>
        ))}
      </div>
    </aside>
  );
}