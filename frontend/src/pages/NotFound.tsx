import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { variants } from '@/lib/motion';

export default function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <motion.div
      variants={variants.pageEnter}
      initial="initial"
      animate="animate"
      exit="exit"
      className="min-h-screen flex flex-col items-center justify-center p-4 text-center"
    >
      <h1 className="text-6xl font-bold text-primary mb-4">404</h1>
      <h2 className="text-2xl font-semibold text-text mb-2">Page not found</h2>
      <p className="text-muted mb-8 max-w-md">
        The page you're looking for doesn't exist or has been moved.
      </p>
      <Button onClick={() => navigate('/')}>Go back home</Button>
    </motion.div>
  );
}
