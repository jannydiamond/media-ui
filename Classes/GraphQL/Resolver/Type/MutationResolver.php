<?php
declare(strict_types=1);

namespace Flowpack\Media\Ui\GraphQL\Resolver\Type;

/*
 * This file is part of the Flowpack.Media.Ui package.
 *
 * (c) Contributors of the Neos Project - www.neos.io
 *
 * This package is Open Source Software. For the full copyright and license
 * information, please view the LICENSE file which was distributed with this
 * source code.
 */

use Flowpack\Media\Ui\Exception;
use Flowpack\Media\Ui\GraphQL\Context\AssetSourceContext;
use Neos\Flow\Annotations as Flow;
use Neos\Flow\Persistence\Exception\IllegalObjectTypeException;
use Neos\Media\Domain\Model\AssetSource\AssetProxy\AssetProxyInterface;
use Neos\Media\Domain\Repository\AssetRepository;
use Neos\Media\Domain\Repository\TagRepository;
use Neos\Media\Exception\AssetServiceException;
use t3n\GraphQL\ResolverInterface;

/**
 * @Flow\Scope("singleton")
 */
class MutationResolver implements ResolverInterface
{
    /**
     * @Flow\Inject
     * @var AssetRepository
     */
    protected $assetRepository;

    /**
     * @Flow\Inject
     * @var TagRepository
     */
    protected $tagRepository;

    /**
     * @param $_
     * @param array $variables
     * @param AssetSourceContext $assetSourceContext
     * @return bool
     * @throws Exception
     * @throws AssetServiceException
     */
    public function deleteAsset($_, array $variables, AssetSourceContext $assetSourceContext): bool
    {
        [
            'id' => $id,
            'assetSource' => $assetSource,
        ] = $variables;

        $assetProxy = $assetSourceContext->getAssetProxy($id, $assetSource);
        if (!$assetProxy) {
            return false;
        }
        $asset = $assetSourceContext->getAssetForProxy($assetProxy);

        if (!$asset) {
            throw new Exception('Cannot delete asset that was never imported', 1591553708);
        }

        try {
            $this->assetRepository->remove($asset);
        } catch (IllegalObjectTypeException $e) {
            throw new Exception('Failed to delete asset', 1591537315);
        }

        return true;
    }

    /**
     * @param $_
     * @param array $variables
     * @param AssetSourceContext $assetSourceContext
     * @return AssetProxyInterface|null
     * @throws Exception
     */
    public function updateAsset($_, array $variables, AssetSourceContext $assetSourceContext): ?AssetProxyInterface
    {
        [
            'id' => $id,
            'assetSource' => $assetSource,
            'label' => $label,
            'caption' => $caption,
            'copyrightNotice' => $copyrightNotice
        ] = $variables + ['label' => null, 'caption' => null, 'copyrightNotice' => 'nix'];

        $assetProxy = $assetSourceContext->getAssetProxy($id, $assetSource);
        if (!$assetProxy) {
            return null;
        }
        $asset = $assetSourceContext->getAssetForProxy($assetProxy);

        if (!$asset) {
            throw new Exception('Cannot update asset that was never imported', 1590659044);
        }

        if ($label !== null) {
            $asset->setTitle($label);
        }

        if ($caption !== null) {
            $asset->setCaption($caption);
        }

        if ($copyrightNotice !== null) {
            $asset->setCopyrightNotice($copyrightNotice);
        }

        try {
            $this->assetRepository->update($asset);
        } catch (IllegalObjectTypeException $e) {
            throw new Exception('Failed to update asset', 1590659063);
        }

        return $assetProxy;
    }

    /**
     * @param $_
     * @param array $variables
     * @param AssetSourceContext $assetSourceContext
     * @return AssetProxyInterface|null
     * @throws Exception
     */
    public function tagAsset($_, array $variables, AssetSourceContext $assetSourceContext): ?AssetProxyInterface
    {
        [
            'id' => $id,
            'assetSource' => $assetSource,
            'tag' => $tagName
        ] = $variables;

        $assetProxy = $assetSourceContext->getAssetProxy($id, $assetSource);
        if (!$assetProxy) {
            return null;
        }
        $asset = $assetSourceContext->getAssetForProxy($assetProxy);

        if (!$asset) {
            throw new Exception('Cannot tag asset that was never imported', 1591561758);
        }

        $tag = $this->tagRepository->findOneByLabel($tagName);

        if (!$tag) {
            throw new Exception('Cannot tag asset with tag that does not exist', 1591561845);
        }

        $asset->addTag($tag);

        try {
            $this->assetRepository->update($asset);
        } catch (IllegalObjectTypeException $e) {
            throw new Exception('Failed to update asset', 1591561868);
        }

        return $assetProxy;
    }

    /**
     * @param $_
     * @param array $variables
     * @param AssetSourceContext $assetSourceContext
     * @return AssetProxyInterface|null
     * @throws Exception
     */
    public function untagAsset($_, array $variables, AssetSourceContext $assetSourceContext): ?AssetProxyInterface
    {
        [
            'id' => $id,
            'assetSource' => $assetSource,
            'tag' => $tagName
        ] = $variables;

        $assetProxy = $assetSourceContext->getAssetProxy($id, $assetSource);
        if (!$assetProxy) {
            return null;
        }
        $asset = $assetSourceContext->getAssetForProxy($assetProxy);

        if (!$asset) {
            throw new Exception('Cannot untag asset that was never imported', 1591561930);
        }

        $tag = $this->tagRepository->findOneByLabel($tagName);

        if (!$tag) {
            throw new Exception('Cannot untag asset from tag that does not exist', 1591561934);
        }

        $asset->removeTag($tag);

        try {
            $this->assetRepository->update($asset);
        } catch (IllegalObjectTypeException $e) {
            throw new Exception('Failed to update asset', 1591561938);
        }

        return $assetProxy;
    }

    /**
     * @param $_
     * @param array $variables
     * @param AssetSourceContext $assetSourceContext
     * @return AssetProxyInterface|null
     * @throws Exception
     */
    public function uploadFile($_, array $variables, AssetSourceContext $assetSourceContext): ?AssetProxyInterface
    {
        // TODO: Implement with GraphQL upload middleware like https://github.com/Ecodev/graphql-upload
        throw new Exception('Not implemented');
    }

    /**
     * @param $_
     * @param array $variables
     * @param AssetSourceContext $assetSourceContext
     * @return AssetProxyInterface|null
     * @throws Exception
     */
    public function uploadFiles($_, array $variables, AssetSourceContext $assetSourceContext): ?AssetProxyInterface
    {
        // TODO: Implement with GraphQL upload middleware like https://github.com/Ecodev/graphql-upload
        throw new Exception('Not implemented');
    }
}
