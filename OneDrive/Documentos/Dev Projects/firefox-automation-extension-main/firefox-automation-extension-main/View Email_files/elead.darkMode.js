function getCookieValue(name) {
    let cookies = document.cookie.split("; ");
    for (let cookie of cookies) {
        let [key, value] = cookie.split("=");
        if (key === name) return value;
    }
    return null;
}

function toggle(value) {
    const isUnify = getCookieValue("IsUnify");

    if ((window.self == window.top) || (isUnify && !window.frameElement)) { //if the page is standalone or coming via Unify
        if (value !== "" && (value === 'true' || value === true)) {
            const h = document.getElementsByTagName('head')[0];
            //check if nightify exist before adding it
            if (document.getElementById("nightify") == null || document.getElementById("nightify").length == 0) {
                const s = document.createElement('style');
                s.setAttribute('type', 'text/css');
                s.setAttribute('id', 'nightify');
                s.appendChild(
                    document.createTextNode(
                        'html{-webkit-filter:invert(100%) hue-rotate(180deg) contrast(70%) !important; background: #fff;} .line-content {background-color: #fefefe;}',
                    ),
                );
                h.appendChild(s);
            }
            return true;
        }
        else {
            //removing extra nightify and keeping one
            const q = document.querySelectorAll('#nightify');
            let i = q.length;
            while (i > 0){
                q[i - 1].parentNode.removeChild(q[i - 1]);
                i--;
            }
            return false;
        }
    }
}
