// Each visible chapter owns one quarter of the scene, even when its copy wraps.
export function chapterProgress(position, landmarks) {
  const chapters = landmarks.length - 1;
  if (position <= landmarks[0]) return 0;
  for (let index = 0; index < chapters; index++) {
    if (position < landmarks[index + 1]) {
      return (index + (position - landmarks[index]) / (landmarks[index + 1] - landmarks[index])) / chapters;
    }
  }
  return 1;
}
