import { createRoot } from 'react-dom/client';

if (!import.meta.env.DEV) throw Error('Artwork review is only available on the development server.');
const { ArtworkReviewApp } = await import('./ArtworkReviewApp');
createRoot(document.getElementById('root')!).render(<ArtworkReviewApp />);
