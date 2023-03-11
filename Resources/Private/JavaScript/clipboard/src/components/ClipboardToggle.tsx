import * as React from 'react';
import { useCallback } from 'react';
import { useRecoilState, useRecoilValue } from 'recoil';

import { Button } from '@neos-project/react-ui-components';

import { AssetIdentity } from '@media-ui/core/src/interfaces';
import { useIntl } from '@media-ui/core/src';
import { initialLoadCompleteState } from '@media-ui/core/src/state';

import ClipboardItem from './ClipboardItem';
import useClipboard from '../hooks/useClipboard';
import clipboardVisibleState from '../state/clipboardVisibleState';

// FIXME: Reading the class name from the CSS module only works in the media-module package right now for some reason, probably a Parcel v1 bug
import './ClipboardToggle.module.css';

const ClipboardToggle: React.FC = () => {
    const { translate } = useIntl();
    const { clipboard } = useClipboard();
    const [clipboardVisible, setClipboardVisible] = useRecoilState(clipboardVisibleState);
    const initialLoadComplete = useRecoilValue(initialLoadCompleteState);

    const toggleClipboard = useCallback(() => setClipboardVisible((prev) => !prev), [setClipboardVisible]);

    const size = Object.keys(clipboard).length;

    if (!initialLoadComplete) return null;

    return (
        <div className="clipboardToggle">
            <Button
                disabled={size === 0}
                size="regular"
                style={clipboardVisible ? 'brand' : 'lighter'}
                hoverStyle="brand"
                onClick={toggleClipboard}
            >
                {translate('clipboard.toggle', 'Clipboard')} ({size})
            </Button>
            {Object.values(clipboard)
                .slice()
                .reverse()
                .slice(0, 3)
                .map((assetIdentity: AssetIdentity) => (
                    <ClipboardItem key={assetIdentity.assetId} assetIdentity={assetIdentity} />
                ))}
        </div>
    );
};

export default React.memo(ClipboardToggle);
