package com.drawin3d;

import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.net.Uri;
import android.util.AtomicFile;
import android.util.Base64;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashMap;

/** Only called on the IO executor. Bounds decoding before allocating image pixels. */
final class ProjectIO {
    static class Image {
        Bitmap bitmap; String payload; float aspect;
    }
    static class Project {
        ArrayList<SceneData.Entity> entities;HashMap<String,Bitmap> images=new HashMap<>();
    }
    static byte[] readBounded(InputStream stream,int limit) throws IOException {
        if(stream==null)throw new IOException("No file content");
        try(InputStream input=stream;ByteArrayOutputStream output=new ByteArrayOutputStream()){
            byte[] buf=new byte[16384];int count,total=0;
            while((count=input.read(buf))!=-1){total+=count;if(total>limit)throw new IOException("File exceeds the import limit");output.write(buf,0,count);}return output.toByteArray();
        }
    }
    static Image image(Context context,Uri uri) throws IOException {
        byte[] data=readBounded(context.getContentResolver().openInputStream(uri),20*1024*1024);
        BitmapFactory.Options options=new BitmapFactory.Options();options.inJustDecodeBounds=true;BitmapFactory.decodeByteArray(data,0,data.length,options);
        if(options.outWidth<=0||options.outHeight<=0||options.outWidth>32768||options.outHeight>32768)throw new IOException("Unsupported or oversized image");
        float aspect=options.outWidth/(float)options.outHeight;if(aspect<.1f||aspect>10)throw new IOException("Use an image with aspect ratio between 1:10 and 10:1");
        options.inSampleSize=1;while(Math.max(options.outWidth,options.outHeight)/options.inSampleSize>1024)options.inSampleSize*=2;
        options.inJustDecodeBounds=false;options.inPreferredConfig=Bitmap.Config.ARGB_8888;
        Bitmap bitmap=BitmapFactory.decodeByteArray(data,0,data.length,options);if(bitmap==null)throw new IOException("Could not decode image");
        // Phone photographs may store their orientation in EXIF rather than in pixels.
        int orientation=1;
        try{androidx.exifinterface.media.ExifInterface exif=new androidx.exifinterface.media.ExifInterface(new java.io.ByteArrayInputStream(data));orientation=exif.getAttributeInt(androidx.exifinterface.media.ExifInterface.TAG_ORIENTATION,1);}catch(IOException ignored){ /* Formats without EXIF already have pixel orientation. */ }
        android.graphics.Matrix transform=new android.graphics.Matrix();
        switch(orientation){
            case 2:transform.setScale(-1,1);break;
            case 3:transform.setRotate(180);break;
            case 4:transform.setScale(1,-1);break;
            case 5:transform.setRotate(90);transform.postScale(-1,1);break;
            case 6:transform.setRotate(90);break;
            case 7:transform.setRotate(-90);transform.postScale(-1,1);break;
            case 8:transform.setRotate(-90);break;
            default:break;
        }
        if(orientation>=2&&orientation<=8){Bitmap upright=Bitmap.createBitmap(bitmap,0,0,bitmap.getWidth(),bitmap.getHeight(),transform,true);if(upright!=bitmap)bitmap.recycle();bitmap=upright;}
        aspect=bitmap.getWidth()/(float)bitmap.getHeight();
        ByteArrayOutputStream bytes=new ByteArrayOutputStream();bitmap.compress(Bitmap.CompressFormat.PNG,100,bytes);
        if(bytes.size()>1500000){bitmap.recycle();throw new IOException("Image is too detailed for the prototype. Resize it below 768 pixels.");}
        Image result=new Image();result.bitmap=bitmap;result.aspect=aspect;result.payload=Base64.encodeToString(bytes.toByteArray(),Base64.NO_WRAP);return result;
    }
    static Project decode(String text) throws Exception {
        Project result=new Project();result.entities=SceneData.decode(text);
        try {
            for(SceneData.Entity e:result.entities)if(e.type.equals("image")){
                byte[] bytes=Base64.decode(e.image,Base64.DEFAULT);BitmapFactory.Options o=new BitmapFactory.Options();o.inJustDecodeBounds=true;BitmapFactory.decodeByteArray(bytes,0,bytes.length,o);
                if(o.outWidth<=0||o.outHeight<=0||o.outWidth>1024||o.outHeight>1024)throw new IOException("Embedded image exceeds 1024 pixels");
                if(Math.abs(o.outWidth/(float)o.outHeight-e.aspect)>.03f)throw new IOException("Image aspect ratio does not match the project");
                o.inJustDecodeBounds=false;Bitmap bitmap=BitmapFactory.decodeByteArray(bytes,0,bytes.length,o);if(bitmap==null)throw new IOException("Invalid embedded image");result.images.put(e.id,bitmap);
            }return result;
        }catch(Exception error){for(Bitmap bitmap:result.images.values())bitmap.recycle();throw error;}
    }
    static void save(Context context,String name,String text) throws IOException {
        byte[] bytes=text.getBytes(StandardCharsets.UTF_8);if(bytes.length>SceneData.MAX_JSON_BYTES)throw new IOException("Project exceeds save budget");
        AtomicFile file=new AtomicFile(new File(context.getFilesDir(),name));FileOutputStream output=null;
        try {output=file.startWrite();output.write(bytes);file.finishWrite(output);}catch(IOException e){file.failWrite(output);throw e;}
    }
    static String load(Context context,String name) throws IOException {
        AtomicFile file=new AtomicFile(new File(context.getFilesDir(),name));return new String(readBounded(file.openRead(),SceneData.MAX_JSON_BYTES),StandardCharsets.UTF_8);
    }
}
