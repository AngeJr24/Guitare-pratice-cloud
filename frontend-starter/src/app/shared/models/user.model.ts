/** Public user data returned by the API. */
export interface ProfilePhoto {
  mimeType: string;
  size: number;
}

export interface User {
  id: string;
  name: string;
  email: string;
  profilePhoto?: ProfilePhoto | null;
  createdAt: string;
}
