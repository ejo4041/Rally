# Living Silk license provenance — November 4, 2026

## Result

No explicit license grant for Living Silk itself was found in the original supplied archives, companion handoff, README or installed source. The package is a privately supplied local component; its metadata does not identify a public upstream repository, author or license. This does not establish who owns it or whether it was originally developed by the entrant in another session. Those facts need the original creation record or the owner's confirmation.

The only license-named material in both supplied distributions is `THIRD_PARTY_NOTICES.txt`, which identifies Three.js and contains its MIT notice. That is not a Living Silk license. Existing Rally MIT scope remains unchanged pending provenance confirmation.

## Original materials inspected

The original delivery remains at `/home/hack/living-silk-handoff/` with `README.md`, `AGENT-HANDOFF.md`, `SHA256SUMS`, a ZIP and an npm-installable TGZ. The server path is provenance evidence, not a public upstream URL. Companion README/handoff describe the component as ready to embed, with native DOM, Three.js and LiveKit examples; they supply no explicit licensing or copyright-holder statement for Living Silk.

| Archive | SHA-256 |
| --- | --- |
| `living-silk-1.0.0.tgz` | `f461fd277255100ae385afe18e341433600e0830a3eb95c75a450fd0427ab224` |
| `living-silk-1.0.0.zip` | `124b5768551a33e57513311d1f3e54d079ed49c983543ad2be9824239851ce34` (verified against supplied SHA256SUMS) |

Rally's tracked `apps/rally-web/vendor/living-silk-1.0.0.tgz` is byte-identical to the original TGZ by SHA-256. Both original manifests identify `living-silk` version `1.0.0`, `private:true`, description “Framework-free expressive WebGL presence with native DOM controls.” Neither has `license`, `author`, `repository` or `homepage` fields. `private:true` is a package-publication setting; it is not a license or proof of ownership.

The original README's distribution section says the delivery contains no personal author fields and preserves required third-party notices. That explains why identifying metadata is absent, but supplies no missing license grant. Rally integration records attribute the package as supplied material; the shader files `livingSilkShader.ts` and `silkMotesShader.ts` remain byte-identical to their archived originals in this inspection.

The source first appears in Rally commit `ee8d7fe`, “Implement continuous Rally presence with browser and native Teams media.” A Git author label or integration commit does not establish authorship of the original package. The companion handoff is an application-specific integration brief, which suggests a packaged deliverable prepared for Rally, but that is an inference—not proof of third-party or entrant ownership.

## Public-source search

Exact-name/API searches for `living-silk`, `createLivingSilk` and related identifiers did not establish an authoritative matching public project in the main inspection. [Separate public-search findings](living-silk-public-source-search-2026-11-04.md) record the delegated investigation. Similar names alone cannot identify a matching license; the inspected archive and API signatures must match.

GitHub's [licensing guidance](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/licensing-a-repository) explains why source availability alone does not confer an open-source license. The exact package's missing explicit grant is unresolved; this research does not make an infringement finding or substitute for ownership evidence.

## Practical next step

Determine where the original delivery was created. If it was original work created for the entrant, confirm that provenance and applicable contributor rights, then include it under an explicit license such as MIT while retaining Three.js attribution. If supplied by an external creator, obtain that creator's license/permission, or use a replacement whose rights are established. Do not attribute Living Silk to a random public project with a similar name.

No component removed or relicensed, no author invented, no external message sent, no runtime deployment or final submission performed. [Current license scope](../licensing.md).
