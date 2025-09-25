'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Upload, FileText, CheckCircle, AlertCircle, Eye, EyeOff, Loader } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { supabase } from '../app/utils/supabaseClient';


// Global type declarations
declare global {
  interface Window {
    OHIFViewer: any;
    cornerstone: any;
    cornerstoneWebImageLoader: any;
    cornerstoneMath: any;
    cornerstoneTools: any;
    jQuery: any;
    $: any;
  }
}
interface UploadedFile {
  image: File | null;
}

interface RadioGraphyType {
  value: string;
  label: string;
}

interface AvailableClass {
  label: string;
  value: number;
}

interface StudyMetadata {
  StudyInstanceUID: string;
  StudyDate: string;
  RadiographyType: string;
  AvailableClasses: AvailableClass[];
  PatientID: string;
}

interface UploadResult {
  study_id: string;
}

interface StudyData {
  study_id: string;
  image_urls: string[];
  seg_url: string;
  AvailableClasses: AvailableClass[];
}

// File Upload Component
interface FileUploadComponentProps {
  onUploadSuccess: (result: UploadResult) => void;
  onUploadStart: () => void;
}

const FileUploadComponent: React.FC<FileUploadComponentProps> = ({
  onUploadSuccess,
  onUploadStart
}) => {
  const [dragActive, setDragActive] = useState<boolean>(false);
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [error, setError] = useState<string>('');

  const router = useRouter();

  useEffect(() => {
    const checkUserSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        router.push('/login');
      }
    };
    checkUserSession();
  }, [router]);

  const validateFile = (file: File): boolean => {
    const validExtensions = ['.nii.gz', '.nii'];
    return validExtensions.some(ext => file.name.toLowerCase().endsWith(ext));
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError('');
    const selected = e.target.files?.[0];
    if (selected && validateFile(selected)) {
      setFile(selected);
    } else {
      setError('Please select a valid .nii or .nii.gz file');
    }
  };

  const handleDrag = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragleave" || e.type === "dragover") {
      setDragActive(e.type === "dragenter" || e.type === "dragover");
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    setError('');
    const droppedFiles = Array.from(e.dataTransfer.files);
    if (droppedFiles.length !== 1) {
      setError('Please upload exactly 1 NIfTI image file');
      return;
    }
    const file = droppedFiles[0];
    if (!validateFile(file)) {
      setError('Please upload only .nii or .nii.gz files');
      return;
    }
    setFile(file);
  }, []);

  const handleUpload = async (): Promise<void> => {
    if (!file) {
      setError('Please select an image file');
      return;
    }
    setIsUploading(true);
    setUploadProgress(0);
    setError('');
    onUploadStart();

    const formData = new FormData();
    formData.append('image_file', file);

    try {
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 200);

      const response = await fetch('http://127.0.0.1:8000/upload', {
        method: 'POST',
        body: formData,
      });

      clearInterval(progressInterval);
      setUploadProgress(100);

      if (response.status !== 202) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Upload failed');
      }

      const result: UploadResult = await response.json();

      setTimeout(() => {
        setIsUploading(false);
        onUploadSuccess(result);
        setFile(null);
        setUploadProgress(0);
      }, 500);

    } catch (err) {
      setIsUploading(false);
      setUploadProgress(0);
      const errorMessage = err instanceof Error ? err.message : 'Upload failed. Please try again.';
      setError(errorMessage);
    }
  };

  const handleLogout = useCallback(async () => {
    await supabase.auth.signOut();
    router.push('/login');
  }, [router]);

  return (
    
    <div className="bg-white rounded-lg shadow-lg p-6 max-w-2xl mx-auto">
      <div>
        <div className="flex justify-end">
          <button
            onClick={handleLogout}
            className="px-4 py-2 bg-red-400 text-white rounded hover:bg-red-700 cursor-pointer transition"
            >
            Logout
          </button>
        </div>
      {/* ...rest of your page content... */}
    </div>
      <h2 className="text-2xl font-bold text-gray-800 mb-6">Upload Medical Image</h2>
      <h4 className="text-2xl font-bold text-gray-800 mb-6">Backend may take up to 50 seconds to start after pressing Upload as it is still in free tier</h4>
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-6 flex items-center">
          <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
          <span className="text-red-700">{error}</span>
        </div>
      )}

      <div
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-all duration-200 ${
          dragActive 
            ? 'border-blue-400 bg-blue-50' 
            : 'border-gray-300 hover:border-gray-400'
        }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <p className="text-lg text-gray-600 mb-2">
          Drag and drop your file here, or click to select
        </p>
        <p className="text-sm text-gray-500">
          Upload exactly 1 file: NIfTI image (.nii or .nii.gz)
        </p>
      </div>

      <div className="mt-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Image File
        </label>
        <div className="relative">
          <input
            type="file"
            accept=".nii,.nii.gz"
            onChange={handleFileSelect}
            className="hidden"
            id="image-upload"
          />
          <label
            htmlFor="image-upload"
            className="flex items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer hover:bg-gray-50"
          >
            {file ? (
              <div className="text-center">
                <FileText className="h-8 w-8 text-green-500 mx-auto mb-2" />
                <p className="text-sm text-gray-600 truncate px-2">
                  {file.name}
                </p>
              </div>
            ) : (
              <div className="text-center">
                <Upload className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-gray-500">Select image file</p>
              </div>
            )}
          </label>
        </div>
      </div>

      {isUploading && (
        <div className="mt-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">Uploading...</span>
            <span className="text-sm text-gray-600">{uploadProgress}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        </div>
      )}

      <button
        onClick={handleUpload}
        disabled={!file || isUploading}
        className={`w-full mt-6 py-3 px-4 rounded-md font-medium transition-all duration-200 ${
          (!file || isUploading)
            ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
            : 'bg-blue-600 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2'
        }`}
      >
        {isUploading ? (
          <div className="flex items-center justify-center">
            <Loader className="animate-spin h-5 w-5 mr-2" />
            Uploading...
          </div>
        ) : (
          'Upload and Process'
        )}
      </button>
    </div>
  );
};

// Segmentation Sidebar Component
interface SegmentationSidebarProps {
  availableClasses: AvailableClass[];
  onToggleVisibility?: (segmentValue: number, isVisible: boolean) => void;
}

const SegmentationSidebar: React.FC<SegmentationSidebarProps> = ({ 
  availableClasses, 
  onToggleVisibility 
}) => {
  const [visibleSegments, setVisibleSegments] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (availableClasses.length > 0) {
      setVisibleSegments(new Set(availableClasses.map(cls => cls.value)));
    }
  }, [availableClasses]);

  const toggleSegment = (value: number): void => {
    const newVisible = new Set(visibleSegments);
    if (newVisible.has(value)) {
      newVisible.delete(value);
    } else {
      newVisible.add(value);
    }
    setVisibleSegments(newVisible);
    
    if (onToggleVisibility) {
      onToggleVisibility(value, newVisible.has(value));
    }
  };

  return (
    <div className="bg-white shadow-lg rounded-lg p-6 h-full overflow-y-auto">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">
        Anatomical Structures
      </h3>
      
      {availableClasses.length === 0 ? (
        <p className="text-gray-500 text-sm">No segmentation data available</p>
      ) : (
        <div className="space-y-3">
          {availableClasses.map((cls) => (
            <div
              key={cls.value}
              className="flex items-center justify-between p-3 bg-gray-50 rounded-md hover:bg-gray-100 transition-colors"
            >
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-800 truncate">
                  {cls.label}
                </p>
                <p className="text-xs text-gray-500">
                  ID: {cls.value}
                </p>
              </div>
              
              <button
                onClick={() => toggleSegment(cls.value)}
                className={`ml-3 p-1 rounded-full transition-colors ${
                  visibleSegments.has(cls.value)
                    ? 'text-blue-600 hover:bg-blue-100'
                    : 'text-gray-400 hover:bg-gray-200'
                }`}
              >
                {visibleSegments.has(cls.value) ? (
                  <Eye className="h-5 w-5" />
                ) : (
                  <EyeOff className="h-5 w-5" />
                )}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// --- CORRECTED DicomViewer Component ---
interface DicomViewerProps {
  studyData: StudyData | null;
}

const DicomViewer: React.FC<DicomViewerProps> = ({ studyData }) => {
  // --- HOOKS CALLED UNCONDITIONALLY AT THE TOP ---
  const [currentSlice, setCurrentSlice] = useState<number>(0);

  // This hook ensures the currentSlice index is valid if the studyData changes.
  // It is now called on every render, which follows the Rules of Hooks.
  useEffect(() => {
    if (studyData && currentSlice >= studyData.image_urls.length) {
      setCurrentSlice(studyData.image_urls.length - 1);
    }
  }, [studyData, currentSlice]);

  // --- CONDITIONAL RETURN HAPPENS AFTER ALL HOOKS ---
  if (!studyData || studyData.image_urls.length === 0) {
    return (
      <div className="bg-black rounded-lg h-full relative overflow-hidden flex flex-col items-center justify-center">
        <div className="text-center text-white">
          <Loader className="animate-spin h-12 w-12 mx-auto mb-4" />
          <p>Waiting for study data...</p>
        </div>
      </div>
    );
  }

  // --- RENDER LOGIC (ASSUMES studyData EXISTS) ---
  const nextSlice = () => {
    setCurrentSlice(prev => Math.min(prev + 1, studyData.image_urls.length - 1));
  };

  const previousSlice = () => {
    setCurrentSlice(prev => Math.max(prev - 1, 0));
  };

  return (
    <div className="rounded-lg h-full relative overflow-hidden flex flex-col">
      {/* Header Controls */}
      <div className="bg-gray-900 text-white p-3 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <h3 className="text-lg font-medium">Image Viewer</h3>
        </div>
        <div className="flex items-center space-x-2 text-sm">
          <span>Slice:</span>
          <input
            type="range"
            min="0"
            max={studyData.image_urls.length - 1}
            value={currentSlice}
            onChange={(e) => setCurrentSlice(parseInt(e.target.value))}
            className="w-32"
          />
          <span>{currentSlice + 1} / {studyData.image_urls.length}</span>
        </div>
      </div>

      {/* Main Viewer Area */}
      <div className="flex-1 relative flex items-center justify-center bg-black max-h-80">
        <img
          key={currentSlice}
          src={studyData.image_urls[currentSlice]}
          alt={`Slice ${currentSlice + 1}`}
          className="max-w-full max-h-full"
          style={{ objectFit: 'contain' }}
        />
      </div>

      {/* Bottom Controls */}
      <div className="bg-gray-900 text-white p-3 flex items-center justify-center space-x-4">
        <button
          onClick={previousSlice}
          disabled={currentSlice === 0}
          className="px-4 py-2 bg-blue-600 rounded hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed"
        >
          Previous
        </button>
        <span className="px-4 py-2 bg-gray-700 rounded">
          {currentSlice + 1} / {studyData.image_urls.length}
        </span>
        <button
          onClick={nextSlice}
          disabled={currentSlice === studyData.image_urls.length - 1}
          className="px-4 py-2 bg-blue-600 rounded hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed"
        >
          Next
        </button>
      </div>
    </div>
  );
};


// Logout Button Component
export function LogoutButton() {
  const router = useRouter();

  const handleLogout = useCallback(async () => {
    await supabase.auth.signOut();
    router.push('/login');
  }, [router]);

  return (
    <button
      onClick={handleLogout}
      className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition"
    >
      Logout
    </button>
  );
}

// Main Application Component
const MedicalImagingApp: React.FC = () => {
  const [currentStudyId, setCurrentStudyId] = useState<string | null>(null);
  const [studyData, setStudyData] = useState<StudyData | null>(null);
  const [availableClasses, setAvailableClasses] = useState<AvailableClass[]>([]);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const handleUploadSuccess = async (uploadResult: { study_id: string }): Promise<void> => {
    setCurrentStudyId(uploadResult.study_id);
    setIsProcessing(true);
  };

  useEffect(() => {
    if (!isProcessing || !currentStudyId) {
      return;
    }

    const pollStatus = async () => {
      try {
        const response = await fetch(`http://127.0.0.1:8000/studies/${currentStudyId}/status`);
        if (!response.ok) throw new Error('Status check failed');
        
        const result = await response.json();

        if (result.status === 'complete') {
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
          }
          
          const instancesResponse = await fetch(
            `http://127.0.0.1:8000/studies/${currentStudyId}/instances`
          );
          if (!instancesResponse.ok) throw new Error('Failed to fetch study data');
          
          const data: StudyData = await instancesResponse.json();
          setStudyData(data);
          setAvailableClasses(data.AvailableClasses || []);
          setIsProcessing(false);
        }
      } catch (error) {
        console.error('Polling failed:', error);
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
        }
        setIsProcessing(false);
      }
    };

    pollStatus();
    pollingIntervalRef.current = setInterval(pollStatus, 3000);

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, [isProcessing, currentStudyId]);

  const handleUploadStart = (): void => {
    setCurrentStudyId(null);
    setStudyData(null);
    setAvailableClasses([]);
    setIsProcessing(false);
  };

  const handleToggleVisibility = (segmentValue: number, isVisible: boolean): void => {
    console.log(`Toggle segment ${segmentValue}: ${isVisible ? 'show' : 'hide'}`);
  };

  const resetToUpload = (): void => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }
    setCurrentStudyId(null);
    setStudyData(null);
    setAvailableClasses([]);
    setIsProcessing(false);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <h1 className="text-2xl font-bold text-gray-900">
              Medical Imaging Viewer
            </h1>
            <div className="text-sm text-gray-500">
              NIfTI to DICOM Converter & Viewer
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {!studyData && !isProcessing ? (
          <FileUploadComponent 
            onUploadSuccess={handleUploadSuccess}
            onUploadStart={handleUploadStart}
          />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-[calc(100vh-200px)]">
            <div className="lg:col-span-1">
              <SegmentationSidebar 
                availableClasses={availableClasses}
                onToggleVisibility={handleToggleVisibility}
              />
            </div>
            <div className="lg:col-span-3">
              <DicomViewer studyData={studyData} />
            </div>
          </div>
        )}

        {isProcessing && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-8 max-w-md mx-4 text-center">
              <Loader className="animate-spin h-12 w-12 mx-auto mb-4 text-blue-600" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Processing Study
              </h3>
              <p className="text-gray-600">
                Converting to DICOM and preparing viewer...
              </p>
            </div>
          </div>
        )}

        {(studyData || isProcessing) && (
          <div className="fixed bottom-6 right-6">
            <button
              onClick={resetToUpload}
              className="bg-blue-600 text-white px-6 py-3 rounded-lg shadow-lg hover:bg-blue-700 transition-colors"
            >
              New Upload
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default MedicalImagingApp;