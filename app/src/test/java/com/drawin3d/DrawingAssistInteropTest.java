package com.drawin3d;

import org.junit.Test;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.charset.StandardCharsets;
import static org.junit.Assert.*;

/** Web authoring helpers bake ordinary strokes; the existing Android app reads them. */
public class DrawingAssistInteropTest {
    @Test public void mirroredSnappedStrokesAndParallelSheetsNeedNoNewFormat() throws Exception {
        Path root=Path.of(System.getProperty("draw3d.projectRoot"));
        var scene=SceneData.decode(new String(Files.readAllBytes(root.resolve("samples/drawing-assists.json")),StandardCharsets.UTF_8));
        assertEquals(12,scene.size());assertEquals(2,scene.stream().filter(e->e.type.equals("paper")).count());
        var copies=new java.util.ArrayList<SceneData.Entity>();
        for(SceneData.Entity e:scene){copies.add(e.copy());if(e.type.equals("stroke")){assertEquals("surface",e.pointSpace);SceneData.Entity p=scene.stream().filter(q->q.id.equals(e.paperId)).findFirst().get();java.nio.FloatBuffer vertices=Paper.ink(e,p).buffer();assertTrue(vertices.remaining()>0);while(vertices.hasRemaining())assertTrue(Float.isFinite(vertices.get()));}}
        String encoded=SceneData.encode(copies);assertEquals(5,new org.json.JSONObject(encoded).getInt("version"));
        Path output=root.resolve("app/build/interop/drawing-assists-android.json");Files.createDirectories(output.getParent());Files.write(output,encoded.getBytes(StandardCharsets.UTF_8));
    }
}
