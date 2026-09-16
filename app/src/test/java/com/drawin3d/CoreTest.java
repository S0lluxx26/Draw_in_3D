package com.drawin3d;

import org.junit.Test;
import org.json.JSONException;
import org.json.JSONObject;
import java.util.Collections;
import static org.junit.Assert.*;

/** A few high-value math and project-integrity checks; device behavior is reviewed later. */
public class CoreTest {
    @Test public void curvedPanelHasContinuousFlatLimitAndExpectedRadius(){
        float[] flat=Math3.curve(1,2,0),nearlyFlat=Math3.curve(1,2,.000001f);
        assertArrayEquals(new float[]{1,0,0},flat,.0001f);assertArrayEquals(flat,nearlyFlat,.0001f);
        float[] curved=Math3.curve(1,2,(float)Math.PI);float radius=2/(float)Math.PI;
        assertEquals(radius,curved[0],.0001f);assertEquals(radius,curved[2],.0001f);
        assertArrayEquals(new float[]{0,0,0},Math3.curve(.5f,2,2),.0001f);
    }
    @Test public void wallDripsDownAndFloorDoesNotDrip(){
        assertArrayEquals(new float[]{0,-1,0},Math3.tangentGravity(new float[]{0,0,1}),.0001f);
        assertArrayEquals(new float[]{0,0,0},Math3.tangentGravity(new float[]{0,1,0}),.0001f);
        float[] normal=Math3.norm(new float[]{0,1,1});assertEquals(0,Math3.dot(normal,Math3.tangentGravity(normal)),.0001f);
    }
    @Test public void raysRejectParallelAndBehindCameraPlanes(){
        assertNull(Math3.planeHit(new float[]{0,1,0},new float[]{1,0,0},new float[]{0,0,0},new float[]{0,1,0}));
        assertNull(Math3.planeHit(new float[]{0,1,0},new float[]{0,1,0},new float[]{0,0,0},new float[]{0,1,0}));
        assertArrayEquals(new float[]{0,0,0},Math3.planeHit(new float[]{0,1,0},new float[]{0,-1,0},new float[]{0,0,0},new float[]{0,1,0}),.0001f);
    }
    @Test public void projectRoundTripPreservesStrokeAndRejectsUnsupportedFormat() throws Exception {
        SceneData.Entity e=new SceneData.Entity();e.points.add(new float[]{.1f,.2f,.3f,.7f});e.wet=true;
        String json=SceneData.encode(Collections.singletonList(e));SceneData.Entity copy=SceneData.decode(json).get(0);
        assertEquals(e.id,copy.id);assertTrue(copy.wet);assertArrayEquals(e.points.get(0),copy.points.get(0),0);
        JSONObject invalid=new JSONObject(json);invalid.put("version",99);
        String badVersion=invalid.toString();assertThrows(JSONException.class,()->SceneData.decode(badVersion));
        invalid=new JSONObject(json);invalid.getJSONArray("entities").getJSONObject(0).put("scale",-1);
        String badScale=invalid.toString();assertThrows(JSONException.class,()->SceneData.decode(badScale));
    }
    @Test public void contentBoundsIncludeScaleAndImageExtent(){
        SceneData.Entity e=new SceneData.Entity();e.points.add(new float[]{1,0,0,1});e.scale=4;assertFalse(SceneData.withinBounds(e));
        e=new SceneData.Entity();e.type="image";e.panelWidth=4;e.position[0]=3;assertFalse(SceneData.withinBounds(e));
    }
    @Test public void sprayGeometryFitsTriangleBudgetAndContainsFiniteVertices(){
        SceneData.Entity e=new SceneData.Entity();e.brush="Spray";
        for(int i=0;i<SceneData.MAX_STROKE;i++)e.points.add(new float[]{i*.001f,0,0,1});
        Geometry mesh=Geometry.stroke(e);assertTrue(mesh.count()/3f/e.points.size()*SceneData.MAX_POINTS<100000);
        java.nio.FloatBuffer buffer=mesh.buffer();while(buffer.hasRemaining())assertTrue(Float.isFinite(buffer.get()));
    }
}
