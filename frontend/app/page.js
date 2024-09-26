'use client';
import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import ChatWindow from './components/ChatWindow'; // Adjust the path if needed

// Main Home component
const Home = () => {
  const searchParams = useSearchParams();
  const [userid,setUserId]= useState('');

  useEffect(() => {
    
    const userFromUrl= searchParams.get('userid');
    if (userFromUrl) {
      setUserId(userFromUrl);
    }
  }, [searchParams]);

  console.log("AppId being used:", userid);

  return (
    <div className='h-100%'>
      <ChatWindow userid={userid}/>
    </div>
  );
};

// Fallback UI while loading
const LoadingFallback = () => <div>Loading chat...</div>;

// Wrapping Home component with Suspense in HomePage
export default function HomePage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <Home />
    </Suspense>
  );
}
