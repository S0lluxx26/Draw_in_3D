package com.drawin3d;
import org.junit.Test;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import static org.junit.Assert.*;

public class StrokeProcessingTest {
    @Test public void curvesRespectPlaneEndpointsAndBudget(){
        var arc=StrokeProcessing.curve(new float[]{2,0,0},new float[]{0,0,1},.5f,false,65,1,1);
        assertEquals(65,arc.size());assertArrayEquals(new float[]{0,0,0,1},arc.get(0),0);assertArrayEquals(new float[]{2,0,0,1},arc.get(64),0);assertEquals(.5f,arc.get(32)[1],0);
        var s=StrokeProcessing.curve(new float[]{2,0,0},new float[]{0,0,1},.5f,true,65,.2f,1.4f);assertTrue(s.get(16)[1]>0&&s.get(48)[1]<0);assertEquals(0,s.get(32)[1],0);
        assertEquals(9,StrokeProcessing.curve(new float[]{0,0,2},new float[]{0,1,0},-.8f,false,9,1,1).size());
    }
    @Test public void smoothingKeepsEndpointsPlanePressureClosureAndBudget(){
        ArrayList<float[]> input=new ArrayList<>();for(int i=0;i<41;i++)input.add(new float[]{i*.025f,i==0||i==40?0:i%2==1?.05f:-.05f,.3f,.1f+i/40f*1.9f});
        var soft=StrokeProcessing.smooth(input,1,384);assertArrayEquals(input.get(0),soft.get(0),0);assertArrayEquals(input.get(40),soft.get(soft.size()-1),0);assertTrue(soft.size()<=128);
        double squares=0;for(float[] p:soft){squares+=p[1]*p[1];assertEquals(.3f,p[2],.00001f);assertTrue(p[3]>=.1f&&p[3]<=2);}assertTrue(Math.sqrt(squares/soft.size())<.025);
        assertEquals(.05f,input.get(1)[1],0);assertEquals(41,StrokeProcessing.smooth(input,1,41).size());
        input.clear();input.add(new float[]{0,0,0,1});input.add(new float[]{1,0,0,1});input.add(new float[]{1,1,0,1});input.add(new float[]{0,1,0,1});input.add(new float[]{0,0,0,1});soft=StrokeProcessing.smooth(input,.8f,24);assertEquals(24,soft.size());assertArrayEquals(soft.get(0),soft.get(23),0);
    }
    @Test public void browserCurvesAndFinishedStrokesUseExistingInterchange() throws Exception {
        Path root=Path.of(System.getProperty("draw3d.projectRoot"));var scene=SceneData.decode(new String(Files.readAllBytes(root.resolve("samples/curves.json")),StandardCharsets.UTF_8));
        assertTrue(scene.size()>=4);for(SceneData.Entity e:scene)if(e.type.equals("stroke")){assertTrue(e.points.size()>=3);assertTrue(SceneData.withinBounds(e));}
        String encoded=SceneData.encode(scene);assertEquals(3,new org.json.JSONObject(encoded).getInt("version"));Path out=root.resolve("app/build/interop/curves-android.json");Files.createDirectories(out.getParent());Files.write(out,encoded.getBytes(StandardCharsets.UTF_8));
    }
}
