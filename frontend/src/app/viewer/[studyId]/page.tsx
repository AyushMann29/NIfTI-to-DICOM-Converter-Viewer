'use client';

import Viewer from '@/components/Viewer';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../utils/supabaseClient';

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

  // Resolve the params promise
  useEffect(() => {
    params.then((resolvedParams) => {
      setStudyId(resolvedParams.studyId);
    }).catch((error) => {
      console.error('Error resolving params:', error);
    });
  }, [params]);

  useEffect(() => {
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
  }, [router]);

  useEffect(() => {
    // Only fetch images when studyId is available and auth is checked
    if (!studyId || !authChecked) return;

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
  }, [studyId, authChecked]);

  // Show loading state while resolving params, checking auth, or fetching images
  if (loading || !studyId || !authChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="text-white text-lg">Loading study...</div>
      </div>
    );
  }

  return (
    <div className="w-screen h-screen bg-black">
      <Viewer studyId={studyId} imageUrls={imageUrls} />
    </div>
  );
}