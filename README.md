# 💊 Little Pharmacist

Jeu éducatif de découverte, inspiré de Little Alchemy, sur les médicaments en vente libre au Québec. On combine médicaments, organes et « Humain » pour apprendre la pharmacologie de base.

> Jeu éducatif. Consultez un pharmacien pour toute question sur vos médicaments.

## Lancer le jeu

Aucune installation n'est requise. Dans ce dossier:

```
python3 -m http.server 8765
```

Puis ouvrez http://localhost:8765/index.html.

## Contenu pharmacologique

Le contenu est séparé du code pour être relu par un pharmacien:

- `contenu.json`: fiches de base
- `contenu_brouillons.json`: brouillons non validés
- `contenu_extension.json`: nouveaux médicaments, organes et fiches non validés

Les fiches marquées `a_valider` n'ont pas été vérifiées par un pharmacien. Le jeu ne contient aucune dose.
