// Request compatibility for generation; never accept another account's text.
export function requestedLibraryIds(body) {
  if (body.libraryIds === undefined || body.libraryIds === null || body.libraryIds === '') {
    return body.libraryId ? [String(body.libraryId).trim()] : [];
  }
  let ids = body.libraryIds;
  if (typeof ids === 'string') {
    try { ids = JSON.parse(ids); } catch { throw new Error('Choose a valid list of library files.'); }
  }
  if (!Array.isArray(ids) || !ids.length || ids.some(id => typeof id !== 'string' || !id.trim())) {
    throw new Error('Choose a valid list of library files.');
  }
  return [...new Set(ids.map(id => id.trim()))];
}

export async function resolveGenerationLesson(req, { readLibrary, extractText, prepareText }) {
  const ids = requestedLibraryIds(req.body);
  if (ids.length) {
    const library = await readLibrary();
    const items = ids.map(id => library.files.find(file => file.id === id && file.userId === req.user.id));
    if (items.some(item => !item)) throw new Error('The selected library file was not found.');
    // The singular response/lesson stays identical to the existing contract.
    if (items.length === 1) return { lesson: items[0].text, name: items[0].name };
    // Each saved file has already passed the existing text preparation limit.
    // Include every selected source instead of silently dropping later files.
    return {
      lesson: items.map((item, i) => `SOURCE ${i + 1}: ${item.name}\n${item.text}`).join('\n\n'),
      name: items.map(item => item.name).join(', '),
    };
  }
  if (!req.file) throw new Error('Please upload a study material.');
  return { lesson: prepareText(await extractText(req.file.path, req.file.originalname)), name: req.file.originalname };
}
