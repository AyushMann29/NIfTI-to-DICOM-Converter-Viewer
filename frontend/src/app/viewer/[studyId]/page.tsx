// app/viewer/[studyId]/page.tsx

import Viewer from '@/components/Viewer';

// The interface can remain the same, as it describes the shape
// of the object *after* the promise has been resolved.
interface ViewerPageProps {
  params: {
    studyId: string;
  };
}

// The function MUST be async to use await.
export default async function ViewerPage({ params }: ViewerPageProps) {
  
  // --- THE DEFINITIVE FIX for Next.js 15 ---
  // We must 'await' the params Promise before we can access its properties.
  const { studyId } = await params;

  return (
    <div className="w-screen h-screen bg-black">
      {/* 
        The 'studyId' variable is now a clean string, which can be safely 
        passed to the Client Component.
      */}
      <Viewer studyId={studyId} />
    </div>
  );
}