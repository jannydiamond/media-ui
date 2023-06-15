import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { Parcel } from '@parcel/core';
import { gql } from '@apollo/client';
import { ApolloServer } from 'apollo-server-express';
import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';

import * as Fixtures from './fixtures/index';

// FIXME: type annotations are missing as they couldn't be included anymore while making the devserver work again
// import { AssetChange, AssetChangeQueryResult, AssetChangeType } from '@media-ui/feature-concurrent-editing/src';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

(async () => {
    const bundlerPort = 8001;
    const frontendPort = 8000;

    const bundler = new Parcel({
        defaultConfig: '@parcel/config-default',
        entries: path.resolve(__dirname, './index.html'),
        defaultTargetOptions: {
            distDir: path.resolve(__dirname, '../dist'),
            publicUrl: '/',
        },
        mode: 'development',
        // cache: false,
        logLevel: 'info',
        serveOptions: {
            publicUrl: '/',
            port: bundlerPort,
            host: 'localhost',
        },
        hmrOptions: {
            port: bundlerPort,
            host: 'localhost',
        },
    });
    bundler.watch();

    let { assets, assetCollections, assetSources, tags } = Fixtures.loadFixtures();

    const filterAssets = (assetSourceId = '', tagId = '', assetCollectionId = '', mediaType = '', searchTerm = '') => {
        return assets.filter((asset) => {
            return (
                (!assetSourceId || asset.assetSource.id === assetSourceId) &&
                (!tagId || asset.tags.find(({ id }) => id === tagId)) &&
                (!assetCollectionId || asset.collections.find(({ id }) => id === assetCollectionId)) &&
                (!searchTerm || asset.label.toLowerCase().indexOf(searchTerm.toLowerCase()) >= 0) &&
                (!mediaType || mediaType === 'all' || asset.file.mediaType.indexOf(mediaType) >= 0)
            );
        });
    };

    const sortAssets = (assets, sortBy, sortDirection) => {
        const sorted = assets.sort((a, b) => {
            if (sortBy === 'name') {
                // Using the label here since teh filename is the same in every fixture
                return a['label'].localeCompare(b['label']);
            }
            return new Date(a['lastModified']).getTime() - new Date(b['lastModified']).getTime();
        });

        return sortDirection === 'DESC' ? sorted.reverse() : sorted;
    };

    const changedAssetsResponse = {
        changedAssets: {
            lastModified: null,
            changes: [],
        },
    };

    const addAssetChange = (change) => {
        changedAssetsResponse.changedAssets.lastModified = change.lastModified;
        changedAssetsResponse.changedAssets.changes.push(change);
    };

    const resolvers = {
        Query: {
            asset: ($_, { id, assetSourceId = 'neos' }) =>
                assets.find((asset) => asset.id === id && asset.assetSource.id === assetSourceId),
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            assets: (
                $_,
                {
                    assetSourceId = 'neos',
                    tagId = null,
                    assetCollectionId = null,
                    mediaType = '',
                    searchTerm = '',
                    limit = 20,
                    offset = 0,
                    sortBy = 'lastModified',
                    sortDirection = 'DESC',
                }
            ) =>
                sortAssets(
                    filterAssets(assetSourceId, tagId, assetCollectionId, mediaType, searchTerm).slice(
                        offset,
                        offset + limit
                    ),
                    sortBy,
                    sortDirection
                ),
            unusedAssets: ($_, { limit = 20, offset = 0 }) =>
                assets.filter(({ isInUse }) => !isInUse).slice(offset, offset + limit),
            unusedAssetCount: () => assets.filter(({ isInUse }) => !isInUse).length,
            changedAssets: ($_, { since }) => {
                const { lastModified, changes } = changedAssetsResponse.changedAssets;
                since = since ? new Date(since) : null;

                return {
                    lastModified,
                    changes: since ? changes.filter((change) => change.lastModified > since) : changes,
                };
            },
            similarAssets: ($_, { id, assetSourceId }) => {
                throw new Error('Not implemented');
            },
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            assetCount: (
                $_,
                { assetSourceId = 'neos', tagId = null, assetCollectionId = null, mediaType = '', searchTerm = '' }
            ) => {
                return filterAssets(assetSourceId, tagId, assetCollectionId, mediaType, searchTerm).length;
            },
            assetUsageDetails: ($_, { id }) => {
                return Fixtures.getUsageDetailsForAsset(id);
            },
            assetUsageCount: ($_, { id, assetSourceId }) => {
                throw new Error('Not implemented');
            },
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            assetVariants: ($_, { id }) => {
                // TODO: Implement assetVariants
                return [];
            },
            assetSources: () => assetSources,
            assetCollections: () => assetCollections,
            assetCollection: ($_, { id }) => assetCollections.find((assetCollection) => assetCollection.id === id),
            tags: () => tags,
            tag: ($_, { id }) => tags.find((tag) => tag.id === id),
            config: () => ({
                uploadMaxFileSize: 1024 * 1024,
                uploadMaxFileUploadLimit: 2,
                currentServerTime: new Date(),
            }),
        },
        Mutation: {
            updateAsset: ($_, { id, assetSourceId, label, caption, copyrightNotice }) => {
                const asset = assets.find((asset) => asset.id === id && asset.assetSource.id === assetSourceId);
                asset.label = label;
                asset.caption = caption;
                asset.copyrightNotice = copyrightNotice;
                asset.lastModified = new Date();
                addAssetChange({
                    lastModified: asset.lastModified,
                    assetId: id,
                    type: 'ASSET_UPDATED',
                });
                return asset;
            },
            setAssetCollectionParent: ($_, { id, parent }: { id: string; parent: string }) => {
                const assetCollection = assetCollections.find((assetCollection) => assetCollection.id === id);
                assetCollection.parent = parent;
                return true;
            },
            updateAssetCollection: ($_, { id, title, tagIds }: { id: string; title: string; tagIds: string[] }) => {
                const assetCollection = assetCollections.find((assetCollection) => assetCollection.id === id);
                if (title) {
                    assetCollection.title = title;
                }
                if (Array.isArray(tagIds)) {
                    assetCollection.tags = tags.filter((tag) => tagIds.includes(tag.id));
                }
                return true;
            },
            deleteAssetCollection: ($_, { id }: { id: string }) => {
                const assetCollection = assetCollections.find((assetCollection) => assetCollection.id === id);
                if (!assetCollection) return false;
                assetCollections = assetCollections.filter((assetCollection) => assetCollection.id !== id);
                return true;
            },
            createAssetCollection: ($_, { title, parent }: { title: string; parent: string }) => {
                const parentCollection = parent
                    ? assetCollections.find((assetCollection) => assetCollection.id === parent)
                    : null;
                const newCollection = {
                    id: `someId_${Date.now()}`,
                    title,
                    parent: parentCollection
                        ? {
                              id: parentCollection.id,
                              title: parentCollection.title,
                          }
                        : null,
                    tags: [],
                    assetCount: 0,
                };
                assetCollections.push(newCollection);
                return newCollection;
            },
            setAssetTags: (
                $_,
                { id, assetSourceId, tagIds }: { id: string; assetSourceId: string; tagIds: string[] }
            ) => {
                const asset = assets.find((asset) => asset.id === id && asset.assetSource.id === assetSourceId);
                asset.tags = tags.filter((tag) => tagIds.includes(tag.id));
                addAssetChange({
                    lastModified: asset.lastModified,
                    assetId: id,
                    type: 'ASSET_UPDATED',
                });
                return asset;
            },
            setAssetCollections: (
                $_,
                {
                    id,
                    assetSourceId,
                    assetCollectionIds: newAssetCollectionIds,
                }: { id: string; assetSourceId: string; assetCollectionIds: string[] }
            ) => {
                const asset = assets.find((asset) => asset.id === id && asset.assetSource.id === assetSourceId);
                asset.collections = assetCollections.filter((collection) =>
                    newAssetCollectionIds.includes(collection.id)
                );
                addAssetChange({
                    lastModified: asset.lastModified,
                    assetId: id,
                    type: 'ASSET_UPDATED',
                });
                return asset;
            },
            deleteTag: ($_, { id }) => {
                tags.splice(
                    tags.findIndex((tag) => tag.id === id),
                    1
                );
                // TODO: Remove tag from assets
                return true;
            },
            deleteAsset: ($_, { id: id, assetSourceId }) => {
                const inUse = Fixtures.getUsageDetailsForAsset(id).reduce(
                    (prev, { usages }) => prev && usages.length > 0,
                    false
                );
                if (inUse) {
                    return false;
                }
                const assetIndex = assets.findIndex(
                    (asset) => asset.id === id && asset.assetSource.id === assetSourceId
                );
                if (assetIndex >= 0) {
                    assets.splice(assetIndex, 1);
                    addAssetChange({
                        lastModified: new Date(),
                        assetId: id,
                        type: 'ASSET_REMOVED',
                    });
                    return true;
                }
                return false;
            },
            createTag: ($_, { tag: newTag }: { tag }) => {
                if (!tags.find((tag) => tag === newTag)) {
                    tags.push(newTag);
                    return newTag;
                }
                return null;
            },
            updateTag: ($_, { id, label }) => {
                throw new Error('Not implemented');
            },
            replaceAsset: ($_, { id, assetSourceId, file, options }) => {
                throw new Error('Not implemented');
            },
            editAsset: ($_, { id, assetSourceId, filename, options }) => {
                throw new Error('Not implemented');
            },
            tagAsset: ($_, { id, assetSourceId, tagId }) => {
                throw new Error('Not implemented');
            },
            untagAsset: ($_, { id, assetSourceId, tagId }) => {
                throw new Error('Not implemented');
            },
            uploadFile: ($_, { file, tagId, assetCollectionId }) => {
                throw new Error('Not implemented');
            },
            uploadFiles: ($_, { files, tagId, assetCollectionId }) => {
                throw new Error('Not implemented');
            },
            importAsset: ($_, { id, assetSourceId }) => {
                throw new Error('Not implemented');
            },
        },
    };

    const graphqlSchema = fs.readFileSync(path.resolve(__dirname, '../../../GraphQL/schema.root.graphql'));

    const typeDefs = gql`
        ${graphqlSchema}
    `;

    const server = new ApolloServer({ typeDefs, resolvers, uploads: false });
    const app = express();

    // @ts-ignore
    server.applyMiddleware({ app, path: '/graphql' });

    app.use((req, res, next) => {
        if (req.query.reset) {
            const fixtures = Fixtures.loadFixtures();
            assets = fixtures.assets;
            assetCollections = fixtures.assetCollections;
            tags = fixtures.tags;
            assetSources = fixtures.assetSources;
            console.log('Fixtures have been reset');
        }
        next();
    });
    app.use(express.static(path.join(__dirname, '../public')));

    const parcelMiddleware = createProxyMiddleware({
        target: `http://localhost:${bundlerPort}`,
    });
    app.use('/', parcelMiddleware);

    app.listen(frontendPort, () => {
        console.info(
            `Media Module dev server running at http://localhost:${frontendPort} and GraphQL at http://localhost:${frontendPort}${server.graphqlPath}`
        );
    });
})();
