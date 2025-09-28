// app/viewer/[studyId]/page.tsx
'use client';

type PageProps = {
  params: {
    studyId: string;
  };
};
import Viewer from '@/components/Viewer';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../utils/supabaseClient';

export default function ViewerPage({ params }: PageProps) {
  const studyId = params.studyId as string;
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
      const res = await fetch(`http://127.0.0.1:8000/studies/${studyId}/instances`);
      if (res.ok) {
        const data = await res.json();
        setImageUrls(data.image_urls);
      }
      setLoading(false);
    };
    fetchImages();
  }, [studyId]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  return (
    <div className="w-screen h-screen bg-black">
      <Viewer studyId={studyId} imageUrls={imageUrls} />
    </div>
  );
}

