// Some changes are saved in two steps (a place + its entrance node, a new point + its walkway,
// a new building + its manager), and the databases do not undo the first step when the second
// one fails. So we undo it ourselves.
// If the undo fails too, we can only write it in the log. The client still gets the first error.
export async function undo(description, step) {
  try {
    await step();
  } catch (undoError) {
    console.error(`Could not undo: ${description}`, undoError);
  }
}
