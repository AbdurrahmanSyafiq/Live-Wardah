export const getDrivePreviewLink = (url: string): string => {
  if (!url || typeof url !== 'string') return '';
  if (url.includes('/preview')) return url;
  if (url.includes('/view')) return url.replace('/view', '/preview');
  const match = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) || url.match(/id=([a-zA-Z0-9_-]+)/);
  if (match && match[1]) return `https://drive.google.com/file/d/${match[1]}/preview`;
  return url;
};

export const getInstagramEmbedLink = (url: string): string => {
  if (!url || typeof url !== 'string') return '';
  if (url.includes('instagram.com/p/') || url.includes('instagram.com/reel/')) {
    let cleanUrl = url.split('?')[0];
    if (cleanUrl.endsWith('/')) cleanUrl = cleanUrl.slice(0, -1);
    return cleanUrl.endsWith('/embed') ? cleanUrl : cleanUrl + '/embed';
  }
  return '';
};