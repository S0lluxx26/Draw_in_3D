package com.drawin3d;

import org.junit.Test;
import org.json.JSONObject;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.charset.StandardCharsets;
import static org.junit.Assert.*;

public class InkGuideTest {
    @Test public void hiddenSheetsPreserveInkAndRejectLossyVersions() throws Exception {
        SceneData.Entity p=new SceneData.Entity(),ink=new SceneData.Entity();p.type="paper";p.bend=180;
        ink.paperId=p.id;ink.pointSpace="surface";ink.points.add(new float[]{-.8f,0,0,1});ink.points.add(new float[]{.8f,.2f,0,.6f});
        java.nio.FloatBuffer before=Paper.ink(ink,p).buffer();p.paperVisible=false;java.nio.FloatBuffer after=Paper.ink(ink,p).buffer();assertEquals(before,after);
        var scene=new java.util.ArrayList<SceneData.Entity>();scene.add(p.copy());scene.add(ink.copy());String text=SceneData.encode(scene);JSONObject doc=new JSONObject(text);assertEquals(5,doc.getInt("version"));
        var reopened=SceneData.decode(text);assertFalse(reopened.get(0).paperVisible);assertArrayEquals(ink.points.get(1),reopened.get(1).points.get(1),0);
        doc.put("version",4);assertThrows(org.json.JSONException.class,()->SceneData.decode(doc.toString()));
        doc.put("version",5);doc.getJSONArray("entities").getJSONObject(0).put("paperVisible","false");assertThrows(org.json.JSONException.class,()->SceneData.decode(doc.toString()));
        p.paperVisible=true;scene.set(0,p);String legacy=SceneData.encode(scene);assertEquals(4,new JSONObject(legacy).getInt("version"));assertTrue(SceneData.decode(legacy).get(0).paperVisible);
    }
    @Test public void browserInkGuidesRoundTripToWeb() throws Exception {
        Path root=Path.of(System.getProperty("draw3d.projectRoot"));String text=new String(Files.readAllBytes(root.resolve("samples/ink-guides-v5.json")),StandardCharsets.UTF_8);
        var scene=SceneData.decode(text);assertTrue(scene.stream().anyMatch(e->e.type.equals("paper")&&!e.paperVisible));
        var copies=new java.util.ArrayList<SceneData.Entity>();for(SceneData.Entity e:scene)copies.add(e.copy());
        String encoded=SceneData.encode(copies);assertEquals(5,new JSONObject(encoded).getInt("version"));
        Path out=root.resolve("app/build/interop/ink-guides-v5-android.json");Files.createDirectories(out.getParent());Files.write(out,encoded.getBytes(StandardCharsets.UTF_8));
    }
}
