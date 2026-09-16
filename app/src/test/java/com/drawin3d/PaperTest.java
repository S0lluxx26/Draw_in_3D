package com.drawin3d;

import org.junit.Test;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.charset.StandardCharsets;
import static org.junit.Assert.*;

public class PaperTest {
    @Test public void browserPaperSurvivesAndroidCopyAndExport() throws Exception {
        Path root=Path.of(System.getProperty("draw3d.projectRoot"));
        var scene=SceneData.decode(new String(Files.readAllBytes(root.resolve("samples/paper-v3.json")),StandardCharsets.UTF_8));
        assertEquals(3,scene.size());assertEquals("paper",scene.get(0).type);
        var copies=new java.util.ArrayList<SceneData.Entity>();
        for(SceneData.Entity e:scene){copies.add(e.copy());if(e.type.equals("stroke"))assertEquals(scene.get(0).id,e.paperId);}
        String encoded=SceneData.encode(copies);assertEquals(3,new org.json.JSONObject(encoded).getInt("version"));
        Path output=root.resolve("app/build/interop/paper-v3-android.json");Files.createDirectories(output.getParent());Files.write(output,encoded.getBytes(StandardCharsets.UTF_8));
        org.json.JSONObject invalid=new org.json.JSONObject(encoded);invalid.put("version",2);assertThrows(org.json.JSONException.class,()->SceneData.decode(invalid.toString()));
        copies.remove(0);assertThrows(org.json.JSONException.class,()->SceneData.decode(SceneData.encode(copies)));
    }
    @Test public void paperGeometryHasFiniteVerticesAndBoundedTextureMemory(){
        SceneData.Entity p=new SceneData.Entity(),e=new SceneData.Entity();p.type="paper";p.position=new float[]{0,1,0};p.yaw=35;p.normal=new float[]{0,1,0};
        e.type="stroke";e.paperId=p.id;e.brush="Water";e.wet=true;e.points.add(new float[]{0,0,0,1});e.points.add(new float[]{1,.1f,0,.7f});
        for(String kind:Paper.KINDS){p.paperKind=kind;assertEquals(6,Paper.sheet(p).count());Geometry mesh=Paper.ink(e,p);assertTrue(mesh.count()>0&&mesh.count()<500);java.nio.FloatBuffer buffer=mesh.buffer();while(buffer.hasRemaining())assertTrue(Float.isFinite(buffer.get()));
            int[] pixels=Paper.pixels(kind,true);assertEquals(256*256,pixels.length);for(int c:pixels){assertEquals(0xffffff,c&0xffffff);assertTrue((c>>>24)>0);}}
    }
    @Test public void sheetCoordinatesAndEdgesRespectOrientationAndScale(){
        for(float[] normal:new float[][]{{0,0,1},{1,0,0},{0,1,0},{0,-1,0}}){SceneData.Entity p=new SceneData.Entity();p.type="paper";p.normal=normal;p.position=new float[]{.2f,1,0};p.yaw=47;p.scale=.8f;
            float[] u=Paper.basis(normal)[0],point=Paper.world(p,Math3.mul(u,.4f));assertArrayEquals(new float[]{.4f,0,0},Paper.coordinates(p,point),.00001f);assertTrue(Paper.inside(p,point));assertFalse(Paper.inside(p,Paper.world(p,Math3.mul(u,2))));}
    }
}
