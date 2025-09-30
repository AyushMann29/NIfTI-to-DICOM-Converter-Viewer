'use client';

import Viewer from '@/components/Viewer';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../src/app/utils/supabaseClient';

type PageProps = {
  params: Promise<{
    studyId: string;
  }>;
};

export default function ViewerPage({ params }: PageProps) {
  const [studyId, setStudyId] = useState<string>('');
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [authChecked, setAuthChecked] = useState(false);
  const [isClient, setIsClient] = useState(false);

  // Mark when we're on client to avoid hydration mismatches
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Resolve the params promise
  useEffect(() => {
    if (!isClient) return;
    
    params.then((resolvedParams) => {
      setStudyId(resolvedParams.studyId);
    }).catch((error) => {
      console.error('Error resolving params:', error);
    });
  }, [params, isClient]);

  useEffect(() => {
    if (!isClient) return;
    
    // Check authentication
    const checkAuth = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (!data.session) {
          router.push('/login');
        } else {
          setAuthChecked(true);
        }
      } catch (error) {
        console.error('Auth check error:', error);
        router.push('/login');
      }
    };

    checkAuth();
  }, [router, isClient]);

  useEffect(() => {
    // Only fetch images when studyId is available and auth is checked
    if (!studyId || !authChecked || !isClient) return;

    const fetchImages = async () => {
      setLoading(true);
      try {
        const res = await fetch(`http://127.0.0.1:8000/studies/${studyId}/instances`);
        if (res.ok) {
          const data = await res.json();
          setImageUrls(data.image_urls);
        } else {
          console.error('Failed to fetch images:', res.status);
        }
      } catch (error) {
        console.error('Failed to fetch images:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchImages();
  }, [studyId, authChecked, isClient]);

  // Show loading state on server and initial client render
  if (!isClient || loading || !studyId || !authChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="text-white text-lg">Loading study...</div>
      </div>
    );
  }

  return (
    <div className="w-screen h-screen bg-black" suppressHydrationWarning>
      <Viewer studyId={studyId} imageUrls={imageUrls} />
    </div>
  );
}