package com.drawin3d;

import org.junit.Test;
import org.json.JSONException;
import java.util.Collections;
import static org.junit.Assert.*;

/** Import hardening: nesting pre-check (Android org.json recursion) and the 1024 px image edge. */
public class ImportSafetyTest {
    private static final String HEAD="{\"version\":1,\"units\":\"metres\",\"coordinates\":\"right-handed-y-up\",\"entities\":[],";
    private static String nest(int depth){return "[".repeat(depth)+"]".repeat(depth);}
    @Test public void deepNestingIsRejectedBeforeParsing(){
        JSONException e=assertThrows(JSONException.class,()->SceneData.decode(HEAD+"\"x\":"+nest(100)+"}"));
        assertTrue(e.getMessage(),e.getMessage().contains("nesting"));
    }
    @Test public void aQuoteInsideAnUnquotedLiteralCannotHideNesting(){
        // Android's tokenizer reads a" as one literal, so these brackets are real nesting, not string content.
        JSONException e=assertThrows(JSONException.class,()->SceneData.decode(HEAD+"\"x\":a\", \"y\":"+nest(100)+", \"z\":\"b\"}"));
        assertTrue(e.getMessage(),e.getMessage().contains("nesting"));
    }
    @Test public void bracketsInStringsAndCommentsAreNotNesting() throws Exception {
        SceneData.Entity sheet=new SceneData.Entity();sheet.type="paper";sheet.paperName="[".repeat(64);
        assertEquals(sheet.paperName,SceneData.decode(SceneData.encode(Collections.singletonList(sheet))).get(0).paperName);
        SceneData.checkDepth("{'a':'"+"{".repeat(80)+"', /* "+"[".repeat(80)+" */ \"b\":[[1]]}",SceneData.MAX_DEPTH);
        SceneData.checkDepth(HEAD+"\"x\":"+nest(SceneData.MAX_DEPTH-1)+"}",SceneData.MAX_DEPTH);
    }
    @Test public void decodedImagesAreFittedToTheSharedEdgeLimit(){
        // 2049 px subsamples to 1024 by integer maths, but decoders round the edge up to 1025.
        int sample=ProjectIO.sampleSize(2049,1537,ProjectIO.MAX_EDGE);assertEquals(2,sample);
        int width=(2049+sample-1)/sample,height=(1537+sample-1)/sample;assertEquals(1025,width);
        assertArrayEquals(new int[]{1024,768},ProjectIO.fit(width,height,ProjectIO.MAX_EDGE));
        assertArrayEquals(new int[]{768,1024},ProjectIO.fit(769,1025,1024));
        assertArrayEquals(new int[]{1024,512},ProjectIO.fit(1024,512,1024));
        for(int w=1;w<=4200;w+=37)for(int h:new int[]{1,103,512,1025,2049,4097}){
            int[] f=ProjectIO.fit(w,h,1024);assertTrue(Math.max(f[0],f[1])<=1024&&Math.min(f[0],f[1])>=1);
            if(Math.max(w,h)<=1024)assertArrayEquals(new int[]{w,h},f);
        }
    }
}
