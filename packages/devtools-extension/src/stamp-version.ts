export const stampVersion = (
  baseVersion: string,
  buildNumber: number,
  isSnapshot: boolean,
): { version: string; version_name?: string } => {
  if (buildNumber < 0) {
    throw new Error(`BUILD_NUMBER ${buildNumber} must be >= 0`);
  }
  if (buildNumber > 65535) {
    throw new Error(`BUILD_NUMBER ${buildNumber} exceeds Chrome max of 65535`);
  }

  const version = `${baseVersion}.${buildNumber}`;

  if (buildNumber === 0) {
    return { version };
  }

  return {
    version,
    version_name: isSnapshot ? `${baseVersion}-snapshot.${buildNumber}` : baseVersion,
  };
};
