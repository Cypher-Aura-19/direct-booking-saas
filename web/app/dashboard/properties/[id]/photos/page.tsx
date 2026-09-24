import { dashboardContext } from "../../../_lib/context";
import { listPropertyPhotos, signedPhotoUrls } from "@/lib/properties/photos";
import { PhotoManager } from "./photo-manager";

export default async function PropertyPhotosPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await dashboardContext();
  const photos = await listPropertyPhotos(supabase, id);
  const urls = await signedPhotoUrls(supabase, photos);

  return <PhotoManager propertyId={id} photos={photos.map((photo) => ({ ...photo, url: urls[photo.id] ?? "" }))} />;
}
