/* global client, plugin */
/* global formatException */

// PLUGIN ENVIRONMENT //

plugin.id = 'topic-diff';

plugin.init =
function _init(glob) {
    this.major = 1;
    this.minor = 0;
    this.version = this.major + '.' + this.minor + ' (21 Feb 2016)';
    this.description = 'Reports topic differences. ' +
    "By James Ross <chatzilla-plugins@james-ross.co.uk>.";

    return 'OK';
}

plugin.enable =
function _enable() {
    client.eventPump.addHook([
        { set: 'channel', type: '332' },
        { set: 'channel', type: 'topic' }
    ],
        plugin.onTopic,
        plugin.id + '-channel-topic');
    return true;
}

plugin.disable =
function _disable() {
    client.eventPump.removeHookByName(plugin.id + '-channel-topic');
    return true;
}

plugin.onTopic =
function _ontopic(e) {
    try {
        if (e.code === 'TOPIC' && e.channel[plugin.id + '-old-topic']) {
            var diffs = calculateLineDifferences(e.channel[plugin.id + '-old-topic'], e.channel.topic);
            var changes = [];
            for (var i = 0; i < diffs.length; i++) {
                if (diffs[i].t === 'a')
                    changes.push('added "' + diffs[i].s + '"');
                else if (diffs[i].t === 'd')
                    changes.push('deleted "' + diffs[i].s + '"');
                else if (diffs[i].t === 'r')
                    changes.push('replaced "' + diffs[i].s1 + '" with "' + diffs[i].s2 + '"');
            }
            if (changes.length > 0) {
                setTimeout(function () {
                    e.channel.display(e.user.unicodeName + ' ' + changes.join(', ') + '.', e.code);
                }, 0);
            }
        }
        e.channel[plugin.id + '-old-topic'] = e.channel.topic;
    } catch (ex) {
        client.display('Topic Difference: ' + formatException(ex));
    }
}

function calculateLineDifferences(oldLine, newLine) {
    var rv = [];
    var oldIndex = 0;
    var newIndex = 0;
    while (oldIndex < oldLine.length && newIndex < newLine.length) {
        var snap = 0;
        while (oldIndex + snap < oldLine.length && newIndex + snap < newLine.length) {
            if (oldLine[oldIndex + snap] != newLine[newIndex + snap])
                break;
            snap++;
        }
        // TODO: What should be the minimum size?
        if (snap >= 5) {
            oldIndex += snap;
            newIndex += snap;
            continue;
        }
        var found = false;
        for (var length = oldLine.length - oldIndex; length > 0; length--) {
            for (var offset = 0; offset <= oldLine.length - oldIndex - length; offset++) {
                var match = oldLine.substr(oldIndex + offset, length);
                var matchIndex = newLine.indexOf(match, newIndex);
                if (matchIndex >= 0) {
                    if (matchIndex > newIndex) {
                        if (offset > 0) {
                            rv.push({
                                t: 'r',
                                i1: oldIndex,
                                s1: oldLine.substr(oldIndex, offset),
                                i2: newIndex,
                                s2: newLine.substr(newIndex, matchIndex - newIndex)
                            });
                        } else {
                            rv.push({
                                t: 'a',
                                i: newIndex,
                                s: newLine.substr(newIndex, matchIndex - newIndex)
                            });
                        }
                    } else if (offset > 0) {
                        rv.push({
                            t: 'd',
                            i: oldIndex,
                            s: oldLine.substr(oldIndex, offset)
                        });
                    }
                    oldIndex += offset + length;
                    newIndex = matchIndex + length;
                    found = true;
                }
                if (found)
                    break;
            }
            if (found)
                break;
        }
        if (found)
            continue;
        rv.push({
            t: 'r',
            i1: oldIndex,
            s1: oldLine.substr(oldIndex, oldLine.length - oldIndex),
            i2: newIndex,
            s2: newLine.substr(newIndex, newLine.length - newIndex)
        });
        oldIndex = oldLine.length;
        newIndex = newLine.length;
    }
    if (oldIndex < oldLine.length) {
        rv.push({ t: 'd', i: oldIndex, s: oldLine.substr(oldIndex) });
    }
    if (newIndex < newLine.length) {
        rv.push({ t: 'a', i: newIndex, s: newLine.substr(newIndex) });
    }
    return rv;
}
