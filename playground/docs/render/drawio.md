# draw.io diagrams

Fences labelled `drawio` hold the XML of a draw.io / diagrams.net diagram: copy it from **File, Export as, XML** (uncompressed), or paste a whole `.drawio` file. The page is drawn read-only.

## Plain XML

```drawio
<mxGraphModel>
  <root>
    <mxCell id="0"/>
    <mxCell id="1" parent="0"/>
    <mxCell id="start" value="Start" style="ellipse;whiteSpace=wrap;html=1;fillColor=#d5e8d4;strokeColor=#82b366;" vertex="1" parent="1">
      <mxGeometry x="40" y="40" width="100" height="50" as="geometry"/>
    </mxCell>
    <mxCell id="check" value="Valid?" style="rhombus;whiteSpace=wrap;html=1;fillColor=#fff2cc;strokeColor=#d6b656;" vertex="1" parent="1">
      <mxGeometry x="200" y="30" width="100" height="70" as="geometry"/>
    </mxCell>
    <mxCell id="ok" value="Save&lt;br&gt;&lt;b&gt;result&lt;/b&gt;" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#dae8fc;strokeColor=#6c8ebf;" vertex="1" parent="1">
      <mxGeometry x="360" y="35" width="110" height="60" as="geometry"/>
    </mxCell>
    <mxCell id="bad" value="Show error" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#f8cecc;strokeColor=#b85450;" vertex="1" parent="1">
      <mxGeometry x="200" y="150" width="100" height="50" as="geometry"/>
    </mxCell>
    <mxCell id="e1" style="edgeStyle=orthogonalEdgeStyle;html=1;endArrow=block;" edge="1" parent="1" source="start" target="check"><mxGeometry relative="1" as="geometry"/></mxCell>
    <mxCell id="e2" value="yes" style="edgeStyle=orthogonalEdgeStyle;html=1;endArrow=block;" edge="1" parent="1" source="check" target="ok"><mxGeometry relative="1" as="geometry"/></mxCell>
    <mxCell id="e3" value="no" style="edgeStyle=orthogonalEdgeStyle;html=1;endArrow=block;" edge="1" parent="1" source="check" target="bad"><mxGeometry relative="1" as="geometry"/></mxCell>
  </root>
</mxGraphModel>
```

## A whole file, with the page compressed (draw.io's default)

```drawio
<mxfile><diagram name="Page-1">tZTNjoMgFIWf5u4tdIzb0f6sJrPoE6BckRSFXGht336iktqmP5kmMzvuOZ4T+IgAL9rTloRrvqxEA3wNvCBrw7RqTwUaAyzREvgKGEuAMWCbJ+5idBMnCLvwm4CYAkdhDjgphW0dofcogaUmAM9LApaqYeWEwingw9nEANlDJ3HoWwDP+0YH3DlRDW5PwgHPm9CaaNfamMIaS2OWS4FZXQHPfSC7xysnrTIsa+B53CBSwNPTQ45SPOEWbYuBzsCSGFhODJLz7dhrGZqY51FrUKsmlqZRE36a1aV4BgpsE5k+5lve8f122HlgSa27e5ZojHYe3+f4gZlcPuKYsZKn6d9wvBB5AZL9E8gHrKTCXRwthcYq2wmzntVrXtjJTyLbA1+Vxlb7C5Ch5TUOlnh7oPEe5h8mCFIYvxrv+B4aoRFBH2/b30AAbDO/A6N380z8AA==</diagram></mxfile>
```

## Not a diagram

```drawio
this is not xml <<<
```
