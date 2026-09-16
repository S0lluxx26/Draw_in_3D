package com.drawin3d;

import org.json.JSONObject;
import org.junit.Test;
import java.util.ArrayList;
import static org.junit.Assert.*;

public class NamedGuideTest {
    @Test public void browserNamedInkGuideReturnsToWebWithItsNameAndGeometry() throws Exception {
        java.nio.file.Path root=java.nio.file.Path.of(System.getProperty("draw3d.projectRoot"));
        String text=new String(java.nio.file.Files.readAllBytes(root.resolve("samples/named-guides-v6.json")),java.nio.charset.StandardCharsets.UTF_8);
        ArrayList<SceneData.Entity> scene=SceneData.decode(text);assertEquals(2,scene.size());
        SceneData.Entity paper=scene.get(0),stroke=scene.get(1);assertEquals("Front wall · 벽",paper.paperName);assertFalse(paper.paperVisible);assertEquals(paper.id,stroke.paperId);
        java.nio.FloatBuffer vertices=Paper.ink(stroke,paper).buffer();assertTrue(vertices.remaining()>0);while(vertices.hasRemaining())assertTrue(Float.isFinite(vertices.get()));
        ArrayList<SceneData.Entity> copies=new ArrayList<>();for(SceneData.Entity e:scene)copies.add(e.copy());
        java.nio.file.Path output=root.resolve("app/build/interop/named-guides-android.json");java.nio.file.Files.createDirectories(output.getParent());java.nio.file.Files.write(output,SceneData.encode(copies).getBytes(java.nio.charset.StandardCharsets.UTF_8));
    }
    @Test public void namesSurviveCopyAndNativeExportWithoutDowngradingVersion() throws Exception {
        SceneData.Entity named=new SceneData.Entity();named.type="paper";named.paperName="Front wall · 벽";named.panelWidth=1;
        SceneData.Entity hidden=new SceneData.Entity();hidden.type="paper";hidden.paperVisible=false;hidden.panelWidth=1;
        ArrayList<SceneData.Entity> scene=new ArrayList<>();scene.add(named.copy());scene.add(hidden);
        String text=SceneData.encode(scene);assertEquals(6,new JSONObject(text).getInt("version"));
        ArrayList<SceneData.Entity> restored=SceneData.decode(text);assertEquals(named.paperName,restored.get(0).paperName);assertFalse(restored.get(1).paperVisible);
        restored.get(0).paperName="";assertEquals(5,new JSONObject(SceneData.encode(restored)).getInt("version"));
    }
    @Test public void invalidAndDowngradedNamesAreRejected() throws Exception {
        SceneData.Entity p=new SceneData.Entity();p.type="paper";p.panelWidth=1;p.paperName="Guide";
        ArrayList<SceneData.Entity> scene=new ArrayList<>();scene.add(p);
        JSONObject doc=new JSONObject(SceneData.encode(scene));doc.put("version",5);reject(doc);
        doc.put("version",6);
        for(Object name:new Object[]{"x".repeat(65),"bad\nname",42,JSONObject.NULL}){doc.getJSONArray("entities").getJSONObject(0).put("paperName",name);reject(doc);}
    }
    private void reject(JSONObject doc){try{SceneData.decode(doc.toString());fail("Invalid name accepted");}catch(org.json.JSONException expected){}}
}
