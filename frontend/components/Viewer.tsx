// components/Viewer.tsx

'use client';

import { useEffect, useRef, useState } from "react";
import SegmentationSidebar from "./SegmentationSidebar";

// --- Cornerstone Core Imports ---
import * as cornerstone from '@cornerstonejs/core';
import {
  RenderingEngine,
  getRenderingEngine,
  Enums as csEnums,
  type StackViewport,
} from '@cornerstonejs/core';

// --- Cornerstone Tools Imports ---
import {
  ToolGroupManager,
  PanTool,
  ZoomTool,
  WindowLevelTool,
  StackScrollTool,
  segmentation,
  Enums as csToolsEnums,
  addTool,
  init as csToolsInit,
} from '@cornerstonejs/tools';

// --- DICOM Loader and Parser Imports ---
import cornerstoneDICOMImageLoader from '@cornerstonejs/dicom-image-loader';

// --- Aliases & Constants ---
const { ViewportType } = csEnums;
const { MouseBindings, SegmentationRepresentations } = csToolsEnums;

const renderingEngineId = 'my-rendering-engine';
const toolGroupId = 'my-tool-group';
const segmentationId = 'DICOM_SEG_ID';

// --- Type Definitions ---
interface StudyData {
  image_urls: string[];
  seg_url: string;
  AvailableClasses: { label: string; value: number }[];
}
type SegmentationVisibility = {
  [key: number]: boolean;
};

// --- Main Viewer Component ---
export default function Viewer({ studyId }: { studyId: string }) {
  const [studyData, setStudyData] = useState<StudyData | null>(null);
  const [visibility, setVisibility] = useState<SegmentationVisibility>({});
  const [error, setError] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);
  const elementRef = useRef<HTMLDivElement>(null);

  // --- Cornerstone Initialization ---
  useEffect(() => {
    let isMounted = true;
    const initialize = async () => {
      try {
        cornerstoneDICOMImageLoader.init();
        await cornerstone.init();
        await csToolsInit();

        cornerstone.imageLoader.registerImageLoader('dicomweb', (imageId, options) => {
          const result = cornerstoneDICOMImageLoader.wadors.loadImage(imageId, options);
          return {
            promise: result.promise.then(image => ({ ...image } as Record<string, unknown>)),
            cancelFn: result.cancelFn,
            decache: result.decache,
          };
        });
        cornerstone.imageLoader.registerImageLoader('wadouri', (imageId, options) => {
          const result = cornerstoneDICOMImageLoader.wadouri.loadImage(imageId, options);
          return {
            promise: result.promise.then(image => ({ ...image, ...image } as Record<string, unknown>)),
            cancelFn: result.cancelFn,
            decache: result.decache,
          };
        });

        // Add tools only once
        addTool(PanTool);
        addTool(ZoomTool);
        addTool(WindowLevelTool);
        addTool(StackScrollTool);

        // Create tool group if not exists
        let toolGroup = ToolGroupManager.getToolGroup(toolGroupId);
        if (!toolGroup) {
          toolGroup = ToolGroupManager.createToolGroup(toolGroupId);
          if (toolGroup) {
            toolGroup.addTool(PanTool.toolName);
            toolGroup.addTool(ZoomTool.toolName);
            toolGroup.addTool(WindowLevelTool.toolName);
            toolGroup.addTool(StackScrollTool.toolName);
          }

          if (toolGroup) {
            toolGroup.setToolActive(WindowLevelTool.toolName, { bindings: [{ mouseButton: MouseBindings.Primary }] });
            toolGroup.setToolActive(PanTool.toolName, { bindings: [{ mouseButton: MouseBindings.Auxiliary }] });
            toolGroup.setToolActive(ZoomTool.toolName, { bindings: [{ mouseButton: MouseBindings.Secondary }] });
            toolGroup.setToolActive(StackScrollTool.toolName, { bindings: [{ mouseButton: MouseBindings.Wheel }] });
          }
        }

        if (isMounted) setInitialized(true);
      } catch (err: unknown) {
        let msg = 'Initialization Error';
        if (err instanceof Error) {
          msg = `Initialization Error: ${err.message}`;
        } else if (typeof err === 'string') {
          msg = `Initialization Error: ${err}`;
        }
        if (isMounted) setError(msg);
      }
    };

    initialize();

    return () => {
      isMounted = false;
      try {
        ToolGroupManager.destroyToolGroup(toolGroupId);
        getRenderingEngine(renderingEngineId)?.destroy();
      } catch { /* ignore cleanup errors */ }
    };
  }, []);

  // --- Data Loading & Rendering ---
  useEffect(() => {
    if (!studyId || !elementRef.current || !initialized) return;
    const element = elementRef.current;

    const loadAndRender = async () => {
      try {
        const response = await fetch(`http://localhost:8000/studies/${studyId}/instances`);
        if (!response.ok) throw new Error("Failed to fetch study data.");
        const data: StudyData = await response.json();
        setStudyData(data);

        // Set initial segmentation visibility
        const initialVisibility: SegmentationVisibility = {};
        data.AvailableClasses.forEach(cls => { initialVisibility[cls.value] = true; });
        setVisibility(initialVisibility);

        // Rendering engine setup
        let renderingEngine = getRenderingEngine(renderingEngineId);
        if (!renderingEngine) {
          new RenderingEngine(renderingEngineId);
          renderingEngine = getRenderingEngine(renderingEngineId);
        }

        const viewportId = 'DICOM_VIEWPORT';
        const viewportInput = { viewportId, type: ViewportType.STACK, element };

        // Enable viewport only if not enabled
        if (renderingEngine && !renderingEngine.getViewport(viewportId)) {
          renderingEngine.enableElement(viewportInput);
        }

        // Add viewport to tool group only if not added
        const toolGroup = ToolGroupManager.getToolGroup(toolGroupId);
        if (toolGroup && !toolGroup.getViewportIds().includes(viewportId)) {
          toolGroup.addViewport(viewportId, renderingEngineId);
        }

        if (!renderingEngine) {
          throw new Error("Rendering engine is not initialized.");
        }
        const viewport = renderingEngine.getViewport(viewportId) as StackViewport;
        await viewport.setStack(data.image_urls);

        // Segmentation setup
        if (data.seg_url) {
          const existingSegs = segmentation.state.getSegmentations().map(seg => seg.id);
          if (!existingSegs.includes(segmentationId)) {
            await segmentation.addSegmentations([{
              segmentationId,
              representation: {
          type: SegmentationRepresentations.Labelmap,
          volume: { volumeId: data.seg_url },
              },
            }]);
          }

          const segReps = segmentation.state.getSegmentationRepresentations(segmentationId);
          if (!segReps.some(rep => 
            'representationData' in rep && 
            typeof rep.representationData === 'object' &&
            rep.representationData !== null &&
            'volumeId' in rep.representationData &&
            (rep.representationData as { volumeId: string }).volumeId === data.seg_url
          )) {
            segmentation.addSegmentationRepresentations(segmentationId, [
              {
                type: SegmentationRepresentations.Labelmap,
                data: {
                  volumeId: data.seg_url,
                },
              },
            ]);
          }
        }

        renderingEngine.render();
            } catch (err: unknown) {
        setError(err.message);
            }
          };

          loadAndRender();
        }, [studyId, initialized]);

        // --- Segmentation Visibility Toggle ---
  const handleToggleVisibility = (segmentValue: number) => {
    const newVisibilityState = !visibility[segmentValue];
    setVisibility(prev => ({ ...prev, [segmentValue]: newVisibilityState }));

    segmentation.config.visibility.setSegmentIndexVisibility(
      segmentationId,
      { segmentationId, type: SegmentationRepresentations.Labelmap },
      Number(newVisibilityState),
      true // Assuming the fourth argument is a boolean for visibility
    );
  };

  // --- Render ---
  return (
    <div className="flex h-full w-full">
      <main className="flex-grow h-full bg-black">
        <div ref={elementRef} className="w-full h-full">
          {!studyData && !error && (
            <div className="text-white w-full h-full flex items-center justify-center">
              Loading viewer...
            </div>
          )}
          {error && (
            <div className="text-red-500 w-full h-full flex items-center justify-center p-4 text-center">
              <p className="font-bold">An error occurred:</p>
              <p>{error}</p>
            </div>
          )}
        </div>
      </main>
      <aside className="w-72 h-full bg-gray-900 p-4 border-l border-gray-700 overflow-y-auto">
        {studyData && (
          <SegmentationSidebar
            classes={studyData.AvailableClasses}
            visibility={visibility}
            onToggle={handleToggleVisibility}
          />
        )}
      </aside>
    </div>
  );
}