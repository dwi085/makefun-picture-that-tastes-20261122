# The Picture That Tastes of One Ingredient

One ripe strawberry on a white plate — drawn entirely in code, no photos, no text.

## Run

```sh
node main.ts            # writes /output/entry.png
node main.ts out.png    # or any output path, for local checks
```

Node 22+, standard library only. The image is deterministic: two runs produce byte-identical PNG files (1024×1024, under 1 MiB).

## License

MIT
