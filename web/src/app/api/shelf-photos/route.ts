import { NextRequest, NextResponse } from 'next/server';
import { deleteShelfPhoto, listShelfPhotos, saveShelfPhoto, type ShelfPhotoPhase } from '@/lib/shelf-photos';

export async function GET(req: NextRequest) {
  try {
    const store = req.nextUrl.searchParams.get('store') || undefined;
    const photos = await listShelfPhotos(store);
    return NextResponse.json({ success: true, photos });
  } catch (e) {
    return NextResponse.json({ success: false, message: (e as Error).message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      storeName: string;
      phase: ShelfPhotoPhase;
      staffName?: string;
      imagePath: string;
    };
    if (!body.storeName || !body.phase || !body.imagePath) {
      return NextResponse.json({ success: false, message: 'storeName, phase, imagePath が必要です' }, { status: 400 });
    }
    const photo = await saveShelfPhoto(body.storeName, body.phase, body.staffName || '', body.imagePath);
    return NextResponse.json({ success: true, photo });
  } catch (e) {
    return NextResponse.json({ success: false, message: (e as Error).message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get('id');
    if (!id) return NextResponse.json({ success: false, message: 'id が必要です' }, { status: 400 });
    await deleteShelfPhoto(id);
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ success: false, message: (e as Error).message }, { status: 500 });
  }
}
