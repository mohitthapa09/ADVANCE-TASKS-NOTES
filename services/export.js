import { doc, getDoc } from '../firebase/firestore.js';
import { db } from '../firebase/config.js';
import { downloadFile, showToast } from '../assets/js/utils.js';

const plainTextFromHtml = (html = '') => {
  const div = document.createElement('div');
  div.innerHTML = html;
  return div.textContent || div.innerText || '';
};

export const exportNote = async (noteId, format = 'pdf') => {
  if (!noteId) {
    showToast('Save the note before exporting.', 'info');
    return;
  }

  const snap = await getDoc(doc(db, 'notes', noteId));
  if (!snap.exists()) {
    showToast('Note not found.', 'error');
    return;
  }
  const note = snap.data();
  const title = note.title || 'Untitled';
  const safeName = title.replace(/[^a-z0-9]/gi, '_').toLowerCase();

  switch (format) {
    case 'pdf': {
      if (!window.html2pdf) {
        showToast('PDF library failed to load', 'error');
        return;
      }
      const container = document.createElement('div');
      container.style.cssText = 'padding:24px;font-family:Arial,sans-serif;color:#111;';
      container.innerHTML = `<h1>${title}</h1>${note.content || ''}`;
      await window.html2pdf().from(container).set({ filename: `${safeName}.pdf` }).save();
      break;
    }
    case 'docx': {
      if (!window.docx) {
        showToast('Word export library failed to load', 'error');
        return;
      }
      const { Document, Packer, Paragraph, TextRun } = window.docx;
      const text = plainTextFromHtml(note.content || '');
      const document_ = new Document({
        sections: [{
          children: [
            new Paragraph({ children: [new TextRun({ text: title, bold: true, size: 32 })] }),
            ...text.split('\n').map((line) => new Paragraph({ children: [new TextRun(line)] }))
          ]
        }]
      });
      const blob = await Packer.toBlob(document_);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${safeName}.docx`;
      a.click();
      URL.revokeObjectURL(url);
      break;
    }
    case 'txt':
      downloadFile(plainTextFromHtml(note.content || ''), `${safeName}.txt`, 'text/plain');
      break;
    default:
      downloadFile(JSON.stringify(note, null, 2), `${safeName}.json`, 'application/json');
  }

  showToast(`Note exported as ${format.toUpperCase()}`, 'success');
};
