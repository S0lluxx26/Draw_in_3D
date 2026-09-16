package com.drawin3d;

import org.junit.Test;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Base64;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import static org.junit.Assert.*;

/** A real browser download must remain editable by the Android scene parser. */
public class WebInteropTest {
    @Test public void browserV2BlocksAndPatternsSurviveAndroidEditingData() throws Exception {
        Path root=Path.of(System.getProperty("draw3d.projectRoot"));
        var scene=SceneData.decode(new String(Files.readAllBytes(root.resolve("samples/editor-v2.json")),StandardCharsets.UTF_8));
        assertEquals(6,scene.size());boolean blockFound=false,patternFound=false;
        for(SceneData.Entity e:scene){
            SceneData.Entity copy=e.copy();assertEquals(e.pattern,copy.pattern);assertArrayEquals(e.size,copy.size,0);
            if(e.type.equals("block")){blockFound=true;assertEquals(36,Geometry.block(e).count());assertTrue(SceneData.withinBounds(e));}
            if(!e.pattern.equals("solid")){patternFound=true;assertTrue(StrokePaths.of(e).size()>1);java.nio.FloatBuffer vertices=Geometry.stroke(e).buffer();while(vertices.hasRemaining())assertTrue(Float.isFinite(vertices.get()));}
        }
        assertTrue(blockFound&&patternFound);String encoded=SceneData.encode(scene);assertEquals(2,new org.json.JSONObject(encoded).getInt("version"));
        Path output=root.resolve("app/build/interop/editor-v2-android.json");Files.createDirectories(output.getParent());Files.write(output,encoded.getBytes(StandardCharsets.UTF_8));
        org.json.JSONObject invalid=new org.json.JSONObject(encoded);invalid.put("version",1);assertThrows(org.json.JSONException.class,()->SceneData.decode(invalid.toString()));
    }
    @Test public void browserAuthoredProjectLoadsAndReexportsWithItsImage() throws Exception {
        Path root=Path.of(System.getProperty("draw3d.projectRoot"));
        var scene=SceneData.decode(new String(Files.readAllBytes(root.resolve("samples/web-authored.json")),StandardCharsets.UTF_8));
        assertEquals(2,scene.size());
        SceneData.Entity stroke=scene.get(0),image=scene.get(1);
        assertEquals("stroke",stroke.type);assertTrue(stroke.wet);
        assertEquals(.002f,stroke.width,0);assertTrue(stroke.points.size()>1);
        assertEquals("image",image.type);assertEquals(175,image.arc,0);assertEquals(.8f,image.scale,0);
        ByteBuffer png=ByteBuffer.wrap(Base64.getDecoder().decode(image.image));
        assertEquals(0x89504e47,png.getInt(0));assertEquals(0x0d0a1a0a,png.getInt(4));
        int width=png.getInt(16),height=png.getInt(20);
        assertTrue(width>0&&height>0&&width<=1024&&height<=1024);
        assertEquals(image.aspect,width/(float)height,.03f);
        String encoded=SceneData.encode(scene);
        assertEquals(image.image,SceneData.decode(encoded).get(1).image);
        Path output=root.resolve("app/build/interop/android-reencoded.json");
        Files.createDirectories(output.getParent());Files.write(output,encoded.getBytes(StandardCharsets.UTF_8));
    }
}
