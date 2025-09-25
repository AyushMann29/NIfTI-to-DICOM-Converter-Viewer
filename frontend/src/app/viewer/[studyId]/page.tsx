// app/viewer/[studyId]/page.tsx
'use client';

import Viewer from '@/components/Viewer';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../utils/supabaseClient';

interface ViewerPageProps {
  params: {
    studyId: string;
  };
}

export default function ViewerPage({ params }: ViewerPageProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [imageUrls, setImageUrls] = useState<string[]>([]);

  useEffect(() => {
    // Check authentication
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        router.push('/login');
      }
    });
  }, [router]);

  useEffect(() => {
    // Fetch image URLs from backend
    const fetchImages = async () => {
      setLoading(true);
      const res = await fetch(`http://127.0.0.1:8000/studies/${params.studyId}/instances`);
      if (res.ok) {
        const data = await res.json();
        setImageUrls(data.image_urls);
      }
      setLoading(false);
    };
    fetchImages();
  }, [params.studyId]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  return (
    <div className="w-screen h-screen bg-black">
      <Viewer studyId={params.studyId} imageUrls={imageUrls} />
    </div>
  );
}

