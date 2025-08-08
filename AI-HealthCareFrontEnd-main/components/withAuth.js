  
    "use client"; 

    import { useEffect } from 'react';
    import { useRouter } from 'next/navigation';
    import { useAuth } from '../app/context/AuthContext'; 

    const withAuth = (WrappedComponent) => {
      return (props) => {
        const { isLoggedIn, loading } = useAuth();
        const router = useRouter();

        useEffect(() => {
          if (!loading && !isLoggedIn) {
            router.replace('/login'); 
          }
        }, [isLoggedIn, loading, router]);

        if (loading || !isLoggedIn) {
        
          return <div className="flex items-center justify-center min-h-screen">กำลังโหลด...</div>;
        }

        return <WrappedComponent {...props} />;
      };
    };

    export default withAuth;
    