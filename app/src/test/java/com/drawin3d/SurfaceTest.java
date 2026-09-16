package com.drawin3d;

import org.junit.Test;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.charset.StandardCharsets;
import static org.junit.Assert.*;

public class SurfaceTest {
    @Test public void signedBendsAndOrientedRayHitsKeepSheetCoordinates(){
        for(float bend:new float[]{0,.01f,-.01f,180,-180,300,-300}){
            SceneData.Entity p=new SceneData.Entity();p.type="paper";p.bend=bend;p.pitch=33;p.roll=-28;p.yaw=71;p.scale=.7f;p.position=new float[]{.2f,1,-.4f};
            for(float[] uv:new float[][]{{0,0,0},{-.7f,.25f,0},{.8f,-.3f,0}}){float[] w=Surface.world(p,uv,0),front=Surface.world(p,uv,.1f),d=Math3.mul(Math3.sub(w,front),10),hit=Surface.hit(p,front,d);assertArrayEquals(uv,Surface.coordinates(p,w),.00001f);assertNotNull(hit);assertArrayEquals(w,hit,.00001f);}
        }
    }
    @Test public void sparseInkFollowsCylinderAndMigrationPreservesPaint(){
        SceneData.Entity p=new SceneData.Entity(),old=new SceneData.Entity();p.type="paper";p.scale=.8f;old.paperId=p.id;old.position=new float[]{.2f,0,0};old.scale=1.4f;old.points.add(new float[]{0,0,0,1});old.points.add(new float[]{.5f,.2f,0,.6f});
        SceneData.Entity e=Surface.localize(old,p);assertArrayEquals(Surface.uv(old,old.points.get(1),p),Surface.uv(e,e.points.get(1),p),.00001f);assertEquals(old.width*old.scale,e.width*e.scale*p.scale,.000001f);
        p.bend=180;Geometry mesh=Paper.ink(e,p);assertEquals(2,e.points.size());assertTrue(mesh.count()>100);double k=Surface.curvature(p),r=1/k-.003/p.scale;java.nio.FloatBuffer b=mesh.buffer();
        for(int i=0;i<mesh.count();i++){float x=b.get(i*Geometry.STRIDE),z=b.get(i*Geometry.STRIDE+2);assertEquals(r,Math.hypot(x,z-1/k),.00001);}
    }
    @Test public void browserV4SurfacesRoundTripWithNoLostFields() throws Exception {
        Path root=Path.of(System.getProperty("draw3d.projectRoot"));String text=new String(Files.readAllBytes(root.resolve("samples/surfaces-v4.json")),StandardCharsets.UTF_8);var scene=SceneData.decode(text);assertEquals(5,scene.size());
        assertEquals(160,scene.get(0).bend,0);assertEquals(15,scene.get(0).pitch,0);assertEquals(-10,scene.get(0).roll,0);assertEquals("surface",scene.get(1).pointSpace);
        var copies=new java.util.ArrayList<SceneData.Entity>();for(SceneData.Entity e:scene)copies.add(e.copy());String encoded=SceneData.encode(copies);assertEquals(4,new org.json.JSONObject(encoded).getInt("version"));
        Path out=root.resolve("app/build/interop/surfaces-v4-android.json");Files.createDirectories(out.getParent());Files.write(out,encoded.getBytes(StandardCharsets.UTF_8));
        org.json.JSONObject invalid=new org.json.JSONObject(encoded);invalid.put("version",3);assertThrows(org.json.JSONException.class,()->SceneData.decode(invalid.toString()));
    }
}
