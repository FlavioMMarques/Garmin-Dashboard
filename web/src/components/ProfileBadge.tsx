interface Props {
  fullName: string | null | undefined;
  photoUrl: string | null | undefined;
}

/** "Olá, <first name>" with the Garmin profile photo (decorative: the name is the text). */
export function ProfileBadge({ fullName, photoUrl }: Props) {
  const firstName = fullName?.trim().split(/\s+/)[0];
  if (!firstName) return null;
  return (
    <div className="profile-badge">
      {photoUrl && (
        <img src={photoUrl} alt="" width={28} height={28} referrerPolicy="no-referrer" />
      )}
      <span>Olá, {firstName}</span>
    </div>
  );
}
