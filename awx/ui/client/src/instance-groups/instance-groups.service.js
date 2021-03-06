export default
    ['$q', 'Rest', function($q, Rest) {
        return {
            addInstanceGroups: function(url, instance_groups) {
                let groups = (instance_groups || []);
                Rest.setUrl(url);
                let defers = groups.map((group) => Rest.post(group));
                return Promise.all(defers);
            },
            editInstanceGroups: function(url, instance_groups) {
                Rest.setUrl(url);
                return Rest.get()
                    .then(res => {
                        const { data: { results = [] } } = res;
                        const updatedGroupIds = (instance_groups || []).map(({ id }) => id);
                        const currentGroupIds = results.map(({ id }) => id);

                        const groupIdsToAssociate = [];
                        const groupIdsToDisassociate = [];
                        // loop over the array of currently saved instance group ids - if we encounter
                        // a difference between the current array and the updated array at a particular
                        // position, mark it and all remaining currentIds in the array for disassociation.
                        let disassociateRemainingIds = false;
                        currentGroupIds.forEach((currentId, position) => {
                            if (!disassociateRemainingIds && updatedGroupIds[position] !== currentId) {
                                disassociateRemainingIds = true;
                            }

                            if (disassociateRemainingIds) {
                                groupIdsToDisassociate.push(currentId);
                            }
                        });

                        updatedGroupIds.forEach(updatedId => {
                            if (groupIdsToDisassociate.includes(updatedId)) {
                                // we get here if the id was marked for disassociation due to being
                                // out of order - we'll need to re-associate it.
                                groupIdsToAssociate.push(updatedId);
                            } else if (!currentGroupIds.includes(updatedId)) {
                                // we get here if the id is a new association
                                groupIdsToAssociate.push(updatedId);
                            }
                        });

                        // convert the id arrays into request data
                        const groupsToAssociate = groupIdsToAssociate.map(id => ({ id, associate: true}));
                        const groupsToDisassociate = groupIdsToDisassociate.map(id => ({ id, disassociate: true }));

                        // make the disassociate request sequence - we need to do these requests
                        // sequentially to make sure they get processed in the right order so we
                        // build a promise chain here instead of using .all()
                        let disassociationPromise = $q.resolve();
                        groupsToDisassociate.forEach(data => {
                            disassociationPromise = disassociationPromise.then(() => {
                                Rest.setUrl(url);
                                return Rest.post(data);
                            });
                        });

                        // make the disassociate-then-associate request sequence
                        return disassociationPromise
                            .then(() => {
                                // we need to do these requests sequentially to make sure they get
                                // processed in the right order so we build a promise chain here
                                // instead of using .all()
                                let associationPromise = $q.resolve();
                                groupsToAssociate.forEach(data => {
                                    associationPromise = associationPromise.then(() => {
                                        Rest.setUrl(url);
                                        return Rest.post(data);
                                    });
                                });
                                return associationPromise;
                            });
                    });
        }
    };
}];
