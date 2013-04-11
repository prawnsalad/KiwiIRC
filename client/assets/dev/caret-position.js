/* =============================================================
 * caret-position.js v1.0.0
 * =============================================================
 * Copyright 2013 Sandglaz, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * ============================================================ */


function getCharacterOffsetWithin(range, node) {
    var treeWalker = document.createTreeWalker(
        node,
        NodeFilter.SHOW_TEXT,
        function(node) {
            var nodeRange = document.createRange();
            nodeRange.selectNode(node);
            return nodeRange.compareBoundaryPoints(Range.END_TO_END, range) < 1 ?
                NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
        },
        false
    );

    var charCount = 0;
    while (treeWalker.nextNode()) {
        charCount += treeWalker.currentNode.length;
    }
    if (range.startContainer.nodeType == 3) {
        charCount += range.startOffset;
    }
    return charCount;
}

function getCaretPosition(containerEl) {
    var range = window.getSelection().getRangeAt(0);
    return getCharacterOffsetWithin(range, containerEl)
}

function setCaretPosition(containerEl, index) {
    var charIndex = 0, stop = {};

    function traverseNodes(node) {
        if (node.nodeType == 3) {
            var nextCharIndex = charIndex + node.length;
            if (index >= charIndex && index <= nextCharIndex) {
                rangy.getSelection().collapse(node, index - charIndex);
                throw stop;
            }
            charIndex = nextCharIndex;
        }
        // Count an empty element as a single character. The list below may not be exhaustive.
        else if (node.nodeType == 1
                 && /^(input|br|img|col|area|link|meta|link|param|base)$/i.test(node.nodeName)) {
            charIndex += 1;
        } else {
            var child = node.firstChild;
            while (child) {
                traverseNodes(child);
                child = child.nextSibling;
            }
        }
    }

    try {
        traverseNodes(containerEl);
    } catch (ex) {
        if (ex != stop) {
            throw ex;
        }
    }
}