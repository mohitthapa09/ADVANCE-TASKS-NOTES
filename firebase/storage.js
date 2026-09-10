import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js';

import { storage, auth } from './config.js';

export { ref, uploadBytes, getDownloadURL, deleteObject, storage };

export const uploadFile = async (file, folder = 'attachments') => {
  const uid = auth.currentUser?.uid || 'anonymous';
  const path = `${folder}/${uid}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
  const fileRef = ref(storage, path);
  await uploadBytes(fileRef, file);
  return {
    url: await getDownloadURL(fileRef),
    name: file.name,
    type: file.type,
    size: file.size,
    path
  };
};